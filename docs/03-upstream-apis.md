# 03. 상위 서버 API와 변환 규칙 (중계 서버 → 센서 서버·기상청·연산 서버)

## 1. 센서 서버 (온도 제공, 형식 고정)

- `SENSOR_BASE_URL`(현재 `http://121.188.206.3:56752`), GET만. 제어용 POST 절대 호출 금지.
- 경로 세그먼트: JE(Jetrz) / EX 실험군 / NH 자돈·GH 육성·FH 비육 / EN1 환경센서·FN1 환기팬·WS1 기상대.

| 위치 | 장비 | 경로 | 사용 항목 |
|---|---|---|---|
| 자돈 NH | 환기팬 | `/sensors/JE/EX/NH/FN1` | FAN1 |
| 자돈 NH | 환경센서 | `/sensors/JE/EX/NH/EN1` | TEMP, RH, CO2, NH3 |
| 육성 GH | 환기팬 / 환경센서 | `/sensors/JE/EX/GH/FN1`, `/EN1` | 위와 같음 |
| 비육 FH | 환기팬 / 환경센서 | `/sensors/JE/EX/FH/FN1`, `/EN1` | 위와 같음 |
| 외부 OU | 기상대 | `/sensors/JE/OU/WS/WS1` | TEMP, RH, WIND, RAIN, SOLAR |

환기팬은 FAN1만 사용(확정). H2S, CURWIND, MAXWIND, VOLT, FAN2·3은 무시.

### 1.1 최신값

`GET /sensors/{장비 경로}` (기간 파라미터 없음).

```json
{ "mode": "latest",
  "data": { "JE": { "EX": { "NH": { "EN1": {
    "TEMP": { "timestamp": "2026-10-05T15:28:10", "value": 27.1 },
    "RH":   { "timestamp": "2026-10-05T15:28:10", "value": 65.0 } } } } } } }
```

- 경로 세그먼트를 따라 내려가 장비 객체를 얻는다. 항목은 키로 찾고 없으면 null.
- timestamp는 타임존 없음 → KST로 보고 `+09:00` 부착. `measuredAt` = 해당 장비 항목 중 최신 timestamp.

### 1.2 이력 (현재 모드 연산 입력용)

`GET /sensors/{장비 경로}/{항목}?start=YYYYMMDDHHmm&end=YYYYMMDDHHmm`

```json
{ "mode": "range", "start": "202610020800", "end": "202610021100",
  "data": { "JE": { "EX": { "NH": { "EN1": { "TEMP": [
    { "timestamp": "2026-10-02T08:00:00", "value": 26.3 },
    { "timestamp": "2026-10-02T08:01:00", "value": 26.3 } ] } } } } } }
```

- 180분 → 181개, timestamp는 정각 분. value는 원자료(예: 26.379999999999995) 그대로 사용, 반올림 금지.
- 연산 입력 3개 항목(설정으로 변경 가능). T_out·RH_out은 연동명세서 v1.0에서 외기로 정의.

| 연산 입력 | 기본 경로(설정 키) |
|---|---|
| `T_out` | `JE/OU/WS/WS1/TEMP` (`INPUT_T_OUT_PATH`) |
| `RH_out` | `JE/OU/WS/WS1/RH` (`INPUT_RH_OUT_PATH`) |
| `fan_pct` | `JE/EX/NH/FN1/FAN1` (`INPUT_FAN_PATH`, 경로 온도 확인 대상) |

- 181개 슬롯에 timestamp로 배치, 빈 분은 null(보간·채움 금지). 세 항목이 모두 비면 `UPSTREAM_ERROR`.

#### 5분 집계·결측 처리 (중계 서버, A안 확정 2026-10-08)

센서 서버는 1분 간격만 제공한다(5분 간격 조회는 시도하지 않는다). 중계 서버가 1분 이력을 5분 간격으로 집계·결측 처리한다. T_out·RH_out·fan_pct 세 항목 모두 같은 규칙을 적용한다.

1. **5분 집계**: 5분 마크 t(00·05·…·55분) 값 = 1분값 t−4,t−3,t−2,t−1,t의 평균(null 제외, 5개 모두 null이면 null, 반올림 금지). 구현 부담이 크면 5분 마크 시각의 1분값을 그대로 사용 가능(그 시각이 null이면 같은 창의 가장 최근 값, 그것도 없으면 null).
2. **짧은 결측 보간**: 1단계 결과에서 null이 연속 3행(15분) 이하면 앞뒤 값 선형 보간. 구간 맨 앞/뒤라 한쪽 값이 없으면 가장 가까운 값을 복사(연속 3행 이하일 때만).
3. **센서 오류 판정**: null이 연속 4행(20분) 이상, 또는 37행 중 8행(20%) 초과면 센서 오류. 연산 서버를 호출하지 않고 화면에 항목별로 "센서 오류: <라벨> (<경로>) — 최근 3시간 중 N분 결측" 표시. 세 항목(기상대 온도 `JE/OU/WS/WS1/TEMP`, 기상대 습도 `JE/OU/WS/WS1/RH`, 환기팬 가동률 `JE/EX/NH/FN1/FAN1`) 각각 판정, 여러 개면 모두 나열. 마지막 정상 결과는 그 시각과 함께 계속 표시.
4. **범위 검사**: 온도 −30~50℃, 습도 0~100%, 팬 0~100% 밖 값은 null로 보고 2·3단계 재적용.

임계값은 `.env` 설정값: `AGG_INTERP_MAX_GAP`, `AGG_ERROR_MIN_GAP`, `AGG_ERROR_MAX_RATIO`, 범위는 `SENSOR_TEMP_MIN`·`SENSOR_TEMP_MAX`·`SENSOR_RH_MIN`·`SENSOR_RH_MAX`·`SENSOR_FAN_MIN`·`SENSOR_FAN_MAX`.

## 2. 기상청 단기예보 조회서비스 (공공데이터포털)

선택 이유: 예측 모드에 미래 24시간 기온·습도가 필요하고 ASOS는 관측값만 있다. 3-1 표시도 같은 서비스·격자·키로 통일.

- 베이스 `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0`
- 공통 파라미터: `serviceKey`, `pageNo=1`, `numOfRows=1000`, `dataType=JSON`, `base_date`, `base_time`, `nx`, `ny`
- `response.header.resultCode`: `"00"` 정상, `"03"` NO_DATA → 직전 발표 시각으로 1회 재요청.

| 오퍼레이션 | 용도 | base_time | category |
|---|---|---|---|
| `getUltraSrtNcst` 초단기실황 | 3-1 | 매시 HH00 | T1H, REH, VEC, PTY (`obsrValue`) |
| `getUltraSrtFcst` 초단기예보 | 3-1 하늘상태 | 매시 HH30 | SKY (`fcstDate`, `fcstTime`, `fcstValue`) |
| `getVilageFcst` 단기예보 | 예측 입력(1시간 단위) | 02·05·08·11·14·17·20·23시 | TMP, REH |

- 발표 시각 계산은 순수 함수 + 테스트(자정 넘김 포함). 제공 지연 시간은 하드코딩하지 말고 NO_DATA 재요청으로 처리.
- 캐시: 같은 (오퍼레이션, base_date, base_time) 응답은 메모리 캐시.
- 예측 입력 계산(series 형식): 각 정시 TMP·REH를 그 시각~59분에 같은 값으로 채워 1분 단위로 만든다. 마지막 실측 다음 분부터 1,440분. 해당 시간대 값이 없으면 가장 가까운 다음 시각 값. 예보 결측 처리: 1시간 값이 비면 앞뒤 정시 값으로 보간. 연속 `FORECAST_GAP_MAX_HOURS`시간(기본 3시간) 이상 결측이거나 조회 자체가 실패하면 "기상청 예보 조회 실패"로 표시하고 연산 서버를 호출하지 않는다.
- summary 형식(연동명세서 v1.0, 확인 중): 24시간 TMP 최대 = T_max, 최소 = T_min, REH 평균 = RH_mean, fan은 `FAN_T_*` 설정값. 검증 T_min < T_max, T_20 < T_50 < T_100.
- 서비스키: 코드에서 URL 인코딩하면 Decoding 키 사용(이중 인코딩 방지). `.env.example` 주석.
- 키 오류 등은 JSON 요청에도 XML 응답 → JSON 파싱 실패 시 본문에서 오류 코드 추출 → `UPSTREAM_ERROR`.
- 격자 변환 스크립트 `apps/relay/scripts/latlon-to-grid.ts`: LCC 상수 RE=6371.00877, GRID=5.0, SLAT1=30, SLAT2=60, OLON=126, OLAT=38, XO=43, YO=136. 테스트: 서울시청(37.5665, 126.9780) → (60, 127).

## 3. 변환 규칙 (순수 함수 + 테스트)

### 날씨 코드

| WeatherCode | 3-1 기상청 | 3-2 미세기후 |
|---|---|---|
| CLEAR | SKY 1 | SOLAR ≥ 700 |
| PARTLY_CLOUDY | 없음 | 400 ≤ SOLAR < 700 |
| MOSTLY_CLOUDY | SKY 3 | 150 ≤ SOLAR < 400 |
| OVERCAST | SKY 4 | SOLAR < 150 이고 RAIN = 0 |
| RAIN | PTY 1, 5 | RAIN > 0 (시간 무관) |
| RAIN_SNOW | PTY 2, 6 | 없음 |
| SNOW | PTY 3, 7 | 없음 |

- 3-1: PTY ≠ 0이면 PTY, 0이면 초단기예보에서 현재 시각에 가장 가까운 fcstTime의 SKY. 초단기예보 실패 + PTY=0이면 null.
- 3-2: SOLAR 판정은 11:00~14:00 측정값에만. 그 외 시간 RAIN=0이면 null(미확정).
- isNight: `FARM_LAT/LON` 기준 일출·일몰(suncalc).

### 풍향 16방위

22.5° 구간, 북(0°)부터 시계방향: 북, 북북동, 북동, 동북동, 동, 동남동, 남동, 남남동, 남, 남남서, 남서, 서남서, 서, 서북서, 북서, 북북서. [348.75, 11.25) = 북. WIND가 문자열이면 그대로, windDeg null.

## 4. 연산 서버

- 회의 결정대로 로컬 구동, HTTP + JSON. 같은 PC(localhost)/같은 공유기 내 다른 PC 미정이라 IP·포트를 `COMPUTE_BASE_URL`에서 수정할 수 있게 한다(공유기면 연산 서버 PC 내부 IP 고정).
- 온도 연동명세서 v1.0은 회의 이전 참고 자료. 회의 결정과 다르면 회의 결정을 따른다. 응답 구조는 우리 쪽이 정한다.
- `COMPUTE_API_KEY`는 기본 비움(로컬 구동). 비어 있으면 헤더를 보내지 않는다.

### 4.1 요청 `POST /v1/current`, `POST /v1/forecast`

```json
{ "request_id": "uuid", "inputs": [
  { "time": "2026-10-05T12:20:00", "T_out": 21.5, "RH_out": 89.7, "fan_pct": 65.0 } ] }
```

- current: 5분 간격 정각 기준 37건(15:26 → 12:20~15:20, 5분 집계).
- forecast(회의 결정, series): 실측 37건 + 예보 288건(5분 간격 보간, fan_pct는 외기 기온 규칙으로 계산) = 325건.
- 연동명세서 v1.0 요약 형식(summary: outdoor T_max·T_min·RH_mean + fan T_100·T_50·T_20)은 확인 중. `FORECAST_INPUT_FORMAT`로 전환 가능하게 빌더 분리.
- 센서 원자료는 반올림·보간 금지, 빈 분은 null. 결측 보간·센서 오류 판정은 1.2의 집계 규칙에서 끝내고, 연산 서버에는 null이 없는 입력만 보낸다(null 있으면 연산 서버가 BAD_REQUEST).

### 4.2 응답 (우리 쪽 정의)

```json
{ "request_id": "uuid", "status": "ok",
  "frames": [ { "time": "2026-10-05T15:20:00",
    "points": { "temp": [], "rh": [], "flow": [[0.12,-0.03,0.01,0.12]] },
    "grid":   { "temp": [], "rh": [] },
    "flow":   [[0.20,0.05,-0.01,0.21]] } ] }
```

- frames: current 1개(마지막 입력 시각), forecast 마지막 실측 시각부터 10분 간격 145개.
- 포인트 좌표와 grid·flow_grid 정의는 응답에 넣지 않는다(고정 형상, 중계 서버 `GEOMETRY_FILE`). 배열 순서·개수는 그 정의를 따른다: points 125, grid 2,584(i + nx×(j + ny×k)), flow 288.
- 125개 포인트 좌표는 온도에서 한 번만 받는다.
- 중계 서버 변환: 시각 `+09:00`, `offsetMin`, range 계산, `geometryId` 부착, 배열 개수 검증. 값은 바꾸지 않는다.
- 오류: `{ "request_id", "status": "error", "message" }` + HTTP 4xx/5xx → `UPSTREAM_ERROR`.
- 연산 30초 초과 시 작업 등록/조회 방식 제안 예정.

### 4.3 Mock

`COMPUTE_MODE=mock`: `MockComputeClient`가 4.2 형식 그대로 생성(시드 고정). 형상은 `GEOMETRY_FILE`을 읽어 그 개수대로 값 생성, temp는 급기구→배기구 기울기 + 입력 T_out 반영, flow는 급기구→배기구 방향 벡터장.

### 4.4 전문가·제어 목업

`mock/expert/*.json`, `mock/control/{energy,environment}.json`을 4.2 형식으로 두고 같은 변환기로 읽는다. 온도 제공 전에는 `npm run mock:generate`.
