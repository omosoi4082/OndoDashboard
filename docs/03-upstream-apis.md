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
| 외부 OU | 기상대 | `/sensors/JE/OU/WS/WS1` | TEMP, RH, WIND, CURWIND, RAIN, SOLAR |

환기팬은 FAN1만 사용(확정). H2S, MAXWIND, VOLT, FAN2·3은 무시.
`CURWIND`(현재 풍속)는 미세기후 패널 풍속 타일에 쓴다(05-open-questions.md #36).

> **WS1은 최신값만 제공되고 이력(range) 조회는 빈 배열이다** (2026-10-13 실측 확인:
> 최신값은 `TEMP 17.3`·`RH 92.3`·`CURWIND 6.0` 등 정상, 같은 항목의 range 조회는 어제
> 구간까지 `[]`). 그래서 **현재·예측 모드 연산 입력의 과거 외기 온·습도는 센서가 아니라
> 기상청 초단기실황을 쓴다**(아래 2장, 2026-10-13 온도 측 B-3 확정). 센서에서 이력을
> 받아 쓰는 연산 입력 항목은 환기팬 가동률(`FN1/FAN1`) 하나뿐이며, 이쪽은 181건 정상이다.

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

`GET /sensors/{장비 경로}/{항목}?start=YYYYMMDDHHmmss&end=YYYYMMDDHHmmss`

> **시각은 반드시 14자리(초 포함)로 보낸다.** 센서 서버가 14자리로 읽기 때문에 12자리
> (`202610090950`)로 보내면 뒤를 0으로 채우지 않고 분·초 자리가 밀려 `09:05:00`으로
> 해석된다(2026-10-13 온도 측 A-1 지적, 실측으로 재현·수정 확인).
> 정각이면 초를 `00`으로 붙인다 — `?start=20261009095000&end=20261009125000`.

```json
{ "mode": "range", "start": "202610020800", "end": "202610021100",
  "data": { "JE": { "EX": { "NH": { "EN1": { "TEMP": [
    { "timestamp": "2026-10-02T08:00:00", "value": 26.3 },
    { "timestamp": "2026-10-02T08:01:00", "value": 26.3 } ] } } } } } }
```

- 180분 → 181개, timestamp는 정각 분. value는 원자료(예: 26.379999999999995) 그대로 사용, 반올림 금지.
- 연산 입력 중 센서 이력을 쓰는 항목은 **환기팬 가동률 1개**(`INPUT_FAN_PATH`, 기본
  `JE/EX/NH/FN1/FAN1`)뿐이다. 외기 온·습도(`T_out`·`RH_out`)는 기상청 초단기실황에서 받는다
  (2026-10-13 B-3 — 1장의 WS1 이력 미제공 참고). `INPUT_T_OUT_PATH`·`INPUT_RH_OUT_PATH`는 폐기.

| 연산 입력 | 출처(설정 키) |
|---|---|
| `T_out` | 기상청 초단기실황 `T1H`, 최근 정시 4회 → 5분 보간(아래) |
| `RH_out` | 기상청 초단기실황 `REH`, 최근 정시 4회 → 5분 보간(아래) |
| `fan_pct` | 센서 `JE/EX/NH/FN1/FAN1` (`INPUT_FAN_PATH`, 경로 온도 확인 대상) |

#### 외기 온·습도(기상청 초단기실황, 2026-10-13 B-3)

- 매시간 적재하지 않고 조회 시점에 `base_date`/`base_time`에 과거 정시를 넣어 직접 조회한다
  (재시작 직후에도 3시간 복구). 입력 구간(180분)을 덮는 정시는 항상 4개다 — 시작 정시(내림)~끝
  정시(내림), 예: 12:20~15:20 → 12·13·14·15시. 직전 발표분 재요청은 하지 않는다.
- 값이 숫자가 아니거나 범위(`SENSOR_TEMP_*`·`SENSOR_RH_*`) 밖이면 그 정시는 결측.
- 결측 1개: 사이면 앞뒤 선형 보간, 맨 뒤(아직 발표 전)면 직전 값, 맨 앞이면 다음 값.
  **연속 2개 이상 결측이면 '기상청 실황 조회 실패'**(`source: "kma"`)로 연산 서버를 호출하지 않는다.
  예측 모드도 실측 구간을 만들 수 없어 같은 문구로 중단된다.
- 5분 마크 값은 정시 사이 선형 보간, 마지막 관측 이후는 마지막 값 유지. 반올림하지 않는다.

- 181개 슬롯에 timestamp로 배치, 빈 분은 null(보간·채움 금지).

#### 5분 집계·결측 처리 (중계 서버, A안 확정 2026-10-08)

센서 서버는 1분 간격만 제공한다(5분 간격 조회는 시도하지 않는다). 중계 서버가 1분 이력을 5분 간격으로 집계·결측 처리한다. 센서 이력을 쓰는 연산 입력은 fan_pct 하나다(B-3).

1. **5분 집계**: 5분 마크 t(00·05·…·55분) 값 = 1분값 t−4,t−3,t−2,t−1,t의 평균(null 제외, 5개 모두 null이면 null, 반올림 금지). 구현 부담이 크면 5분 마크 시각의 1분값을 그대로 사용 가능(그 시각이 null이면 같은 창의 가장 최근 값, 그것도 없으면 null).
2. **짧은 결측 보간**: 1단계 결과에서 null이 연속 3행(15분) 이하면 앞뒤 값 선형 보간. 구간 맨 앞/뒤라 한쪽 값이 없으면 가장 가까운 값을 복사(연속 3행 이하일 때만).
3. **센서 오류 판정**: null이 연속 4행(20분) 이상, 또는 37행 중 8행(20%) 초과면 센서 오류. 연산 서버를 호출하지 않고 화면에 항목별로 "센서 오류: <라벨> (<경로>) — 최근 3시간 중 N분 결측" 표시. 대상은 환기팬 가동률 `JE/EX/NH/FN1/FAN1`(B-3 이전에는 기상대 온·습도도 포함). 마지막 정상 결과는 그 시각과 함께 계속 표시.
4. **범위 검사**: 온도 −30~50℃, 습도 0~100%, 팬 0~100% 밖 값은 null로 보고 2·3단계 재적용.

임계값은 `.env` 설정값: `AGG_INTERP_MAX_GAP`, `AGG_ERROR_MIN_GAP`, `AGG_ERROR_MAX_RATIO`, 범위는 `SENSOR_TEMP_MIN`·`SENSOR_TEMP_MAX`·`SENSOR_RH_MIN`·`SENSOR_RH_MAX`·`SENSOR_FAN_MIN`·`SENSOR_FAN_MAX`.

## 2. 기상청 단기예보 조회서비스 (공공데이터포털)

선택 이유: 예측 모드에 미래 24시간 기온·습도가 필요하고 ASOS는 관측값만 있다. 3-1 표시도 같은 서비스·격자·키로 통일.

- 베이스 `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0`
- 공통 파라미터: `serviceKey`, `pageNo=1`, `numOfRows=1000`, `dataType=JSON`, `base_date`, `base_time`, `nx`, `ny`
- `response.header.resultCode`: `"00"` 정상, `"03"` NO_DATA → 직전 발표 시각으로 1회 재요청.

| 오퍼레이션 | 용도 | base_time | category |
|---|---|---|---|
| `getUltraSrtNcst` 초단기실황 | 3-1 화면 + **현재·예측 입력의 과거 외기** | 매시 HH00 | T1H, REH, VEC, PTY, **WSD**(풍속), **RN1**(1시간 강수량) (`obsrValue`) |
| `getUltraSrtFcst` 초단기예보 | 3-1 하늘상태 | 매시 HH30 | SKY (`fcstDate`, `fcstTime`, `fcstValue`) |
| `getVilageFcst` 단기예보 | 예측 입력(1시간 단위) | 02·05·08·11·14·17·20·23시 | TMP, REH |

- 발표 시각 계산은 순수 함수 + 테스트(자정 넘김 포함). 제공 지연 시간은 하드코딩하지 말고 NO_DATA 재요청으로 처리.
- 단기예보 `NO_DATA`(발표가 늦게 올라온 경우)는 최신 발표분에서 `KMA_VILAGE_MAX_STEPS_BACK`(기본 2) 단계 이전까지 내려가며 재요청한다(2026-10-13 23:30 실측: 23:00·20:00 연속 `NO_DATA`). 초단기실황·초단기예보는 1단계.
- 캐시: 같은 (오퍼레이션, base_date, base_time) 응답은 메모리 캐시. 성공 응답만 남기고 `NO_DATA`·실패는 캐시하지 않는다.
- 예측 입력 계산(series 형식, 2026-10-08 5분 간격으로 확정): 정시 TMP·REH 사이를 5분 단위로 선형 보간한다(보간이 어려우면 그 시간대 내 동일값 유지). 마지막 실측(현재 모드와 같은 5분 집계 구간) 다음 5분부터 288건(24시간). 해당 시간대 값이 없으면 가장 가까운 다음 시각 값. 예보 결측 처리: 1시간 값이 비면 앞뒤 정시 값으로 보간. 연속 `FORECAST_GAP_MAX_HOURS`시간(기본 3시간) 이상 결측이거나 조회 자체가 실패하면 "기상청 예보 조회 실패"로 표시하고 연산 서버를 호출하지 않는다. 예보 구간의 `fan_pct`는 null 대신 **외기 기온 5단 구간 표**로 채운다(2026-10-13 온도 측 B-4 확정 — 그 전까지 쓰던 직선 보간식 `clamp(20 + 80×(T_out−22)/8, 20, 100)`은 폐기).

| 예보 기온 `T_out` | `fan_pct` |
|---|---|
| 22 ℃ 미만 | 20 % |
| 22 ℃ 이상 ~ 24 ℃ 미만 | 40 % |
| 24 ℃ 이상 ~ 26 ℃ 미만 | 60 % |
| 26 ℃ 이상 ~ 28 ℃ 미만 | 80 % |
| 28 ℃ 이상 | 100 % |

경계값은 **아래쪽 포함, 위쪽 미포함**(24.0 ℃ → 60 %). 5분 행마다 그 행의 예보 기온으로 정하고 습도는 보지 않는다. 기준 온도·환기량 값은 `.env`에 둔다(나중에 바꿀 수 있게) — `FAN_STEP_TEMPS=22,24,26,28`(경계, 오름차순), `FAN_STEP_PCTS=20,40,60,80,100`(구간별 값, 경계보다 1개 많게).
- **과거 3시간 외기 온·습도(현재·예측 입력, 2026-10-13 B-3 확정)**: 초단기실황 `T1H`·`REH`를 쓴다.
  - 매시 정각 관측값이 40분 뒤 조회된다. 중계 서버는 **조회 시점에 `base_date`/`base_time`에 과거 정시를 넣어 최근 정시 4회를 직접 조회**한다(단기예보와 같은 서비스·같은 인증키라 추가 발급 불필요). 온도 측 제안은 "매시간 저장해 두기"였으나, 직접 조회하면 중계 서버를 재시작한 직후에도 과거 3시간을 바로 복구할 수 있어 이 방식으로 간다(회신문 2장).
  - 정시 값 4개를 **5분 간격으로 선형 보간**하고, **마지막 관측 이후는 마지막 값을 유지**한다.
  - 결측 1개는 앞뒤 정시 값으로 보간. **2개 이상 연속 결측이면 "기상청 실황 조회 실패"** 로 표시하고 연산 서버를 호출하지 않는다 — 이때 실측 구간 입력을 만들 수 없어 예측 모드도 함께 중단된다(연산 서버 `BAD_REQUEST` 규칙 "실측 2.5시간 미만"에 걸림). 현재·예측 양쪽에 같은 문구를 띄운다.
  - 화면의 미세기후 패널(3-2)은 그대로 기상대(WS1) 최신값을 쓴다 — 바뀌는 것은 연산 입력뿐이다.
- summary 형식(연동명세서 v1.0)은 폐기(2026-10-07 확정, 05-open-questions.md #4) — 빌더를 만들지 않는다. `FORECAST_INPUT_FORMAT` 분기도 series 고정으로 단순화한다.
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
- 연동명세서 v1.0 요약 형식(summary: outdoor T_max·T_min·RH_mean + fan T_100·T_50·T_20)은 폐기(2026-10-07 확정, 05-open-questions.md #4) — series 빌더만 만든다. `FORECAST_INPUT_FORMAT` 분기는 제거해도 된다.
- 센서 원자료는 반올림·보간 금지, 빈 분은 null. 결측 보간·센서 오류 판정은 1.2의 집계 규칙에서 끝내고, 연산 서버에는 null이 없는 입력만 보낸다(null 있으면 연산 서버가 BAD_REQUEST).

### 4.2 응답 (우리 쪽 정의)

```json
{ "request_id": "uuid", "status": "ok", "model_version": "pinn-v17.0",
  "frames": [ { "time": "2026-10-05T15:20:00",
    "points": { "temp": [], "rh": [], "flow": [[0.12,-0.03,0.01,0.12]] },
    "grid":   { "temp": [], "rh": [] },
    "flow":   [[0.20,0.05,-0.01,0.21]],
    "outdoor": { "T_out": 21.5, "RH_out": 89.7, "fan_pct": 65.0 },
    "summary": { "T_mean": 27.3, "T_min": 23.9, "T_max": 30.4, "T_west": 27.3, "T_east": 27.3,
                 "RH_mean": 67.2, "V_mean": 0.23, "V_max": 0.32 },
    "quality": { "in_range": true, "warnings": [] } } ] }
```

- `model_version`(top-level)·프레임별 `outdoor`(입력 그대로)·`summary`(프레임 요약 통계)·
  `quality`(물리적 유효성 플래그·경고 문구) 4개 필드는 05-open-questions.md #2(2026-10-07
  확정) 추가분이다. `packages/shared`의 `DetailBase.model_version`·`DetailFrame.outdoor`·
  `DetailFrame.summary`·`DetailFrame.quality`로 반영돼 있다.
- frames: current 1개(마지막 입력 시각), forecast 마지막 실측 시각부터 10분 간격 145개.
- 포인트 좌표와 grid·flow_grid 정의는 응답에 넣지 않는다(고정 형상, 중계 서버 `GEOMETRY_FILE`). 배열 순서·개수는 그 정의를 따른다: points 125, grid 2,584(i + nx×(j + ny×k)), flow 288.
- 125개 포인트 좌표는 온도에서 한 번만 받는다.
- 중계 서버 변환: 시각 `+09:00`, `offsetMin`, range 계산, `geometryId` 부착, 배열 개수 검증. 값은 바꾸지 않는다.
- 오류(2026-10-13 온도 측 D-4 확정): `{ "request_id"?, "status": "error", "code": "BAD_REQUEST" | "SERVER" | "BUSY", "field"?, "message" }` + HTTP 4xx/5xx → `UPSTREAM_ERROR`. `code`는 구버전 목업에 없으므로 optional이며, 없거나 모르는 값이면 재시도하지 않는다.
  - `BAD_REQUEST`: 재시도하지 않는다. 메시지는 `예측 서버 요청 거부: <message> (항목: <field>)`(field 없으면 괄호 생략).
  - `SERVER`: `COMPUTE_RETRY_DELAY_MS`(기본 60000 = 1분) 뒤 1회 재시도. 그래도 실패하면 `예측 서버 오류`.
  - `BUSY`: 같은 대기 뒤 재시도. 횟수는 온도 측이 정하지 않아 1회로 둔다. 그래도 실패하면 `예측 서버가 다른 계산 중이라 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.`
  - 타임아웃(`COMPUTE_TIMEOUT_MS`)·연결 실패: 재시도하지 않는다. `UPSTREAM_TIMEOUT`/`UPSTREAM_UNREACHABLE`, 메시지 `예측 서버 연결 안 됨`. 마지막 정상 결과 유지는 대시보드가 맡는다.
  - 재시도는 `COMPUTE_MODE=http`에만 적용한다(`withComputeRetry`, mock은 code를 내지 않음). 재시도가 걸리면 relay 응답까지 최대 약 `2 × COMPUTE_TIMEOUT_MS + COMPUTE_RETRY_DELAY_MS`가 걸린다.
- 상태 확인(2026-10-13 D-5): `GET /v1/health`, HTTP 2xx면 살아 있음. `/api/health`의 `compute`에 쓴다(타임아웃 `UPSTREAM_TIMEOUT_MS`). mock 모드는 항상 `ok`.
- 연산 30초 초과 시 작업 등록/조회 방식 제안 예정.

### 4.3 Mock

`COMPUTE_MODE=mock`: `MockComputeClient`가 4.2 형식 그대로 생성(시드 고정). 형상은 `GEOMETRY_FILE`을 읽어 그 개수대로 값 생성, temp는 급기구→배기구 기울기 + 입력 T_out 반영, flow는 급기구→배기구 방향 벡터장.

### 4.4 전문가·제어 목업

`mock/mock_expert.json`, `mock/mock_control.json`(2026-10-08 온도 측 v2 제공, 서브폴더 아님)을 "연산 서버 원응답 + 목업 전용 필드"로 두고 relay가 현재/예측과 같은 변환기(offsetMin·+09:00·range·geometryId 부착)로 감싸 읽는다. `mock_control.json`은 `target:"energy"` 시나리오 하나뿐 — `environment` 요청도 같은 파일을 쓰고 응답 `target` 필드만 요청값으로 덮어쓴다(05-open-questions.md #27). 온도 측 파일이 없을 때만 `npm run mock:generate`(합성 폴백)를 쓴다.
