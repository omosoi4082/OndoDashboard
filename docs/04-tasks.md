# 04. 작업 단계

계약 기간 1개월차(돈사 대시보드) 기준. 단계마다 완료 조건을 확인하고 요약 보고 후 다음 단계로 넘어간다. 공통 완료 조건: `npm run typecheck && npm test && npm run lint` 통과.

## 2026-10-07 중계 서버 명세서 답변 반영 — 할 일

`중계서버_명세서_v001_확인사항_답변_20261007.docx`(온도 예측 모델 담당 회신)와 `연산서버_첨부파일_20261007.zip`(geometry.json, sample_request/response, mock_expert.json, mock_control_energy.json, mock_control_environment.json) 검토 결과. 해결된 미확정 사항은 `docs/05-open-questions.md`에 반영 완료(1~6, 8~9, 11~16, 7·18 부분). 아래는 코드·문서에 실제 반영해야 할 작업 목록이며, 해당 마일스톤 작업 시작 전에 먼저 처리한다.

- [x] **문서 동기화(우선)**: `docs/02-relay-api.md` 6장, `docs/03-upstream-apis.md` 1.2·4.1·4.4장, `CLAUDE.md`의 "181건"/"1분 확장 1,440건" 서술을 5분 간격(현재 37건, 예측 실측 37 + 예보 288 = 325건)으로 갱신. `packages/shared` 타입에 top-level `model_version`, 프레임별 `outdoor`·`summary`·`quality` 필드 추가(05-open-questions #2, #5, #26).
- [x] **M4(현재 모드)**: `SensorHistoryClient`를 181 슬롯(1분)이 아닌 37 슬롯(5분 간격)으로 변경. 실제 센서 서버 API는 1분 간격만 제공(확인 완료, 05-open-questions #26) — 센서 서버에 5분 간격 이력 조회를 먼저 시도하고, 지원하지 않으면 1분 이력을 조회해 5분 마크(00·05·…·55분)만 선택(평균·보간 금지)해 연산 서버에는 5분 간격으로 넘긴다.
- [x] **M5(예측 모드)**: 예보 5분 간격 288건(실측 37+예보 288=325건) 구현 완료. `fan_pct` 클램프 계산식·`forecast_from`/`forecast_issued_at` 포함. summary 형식 폐기, `FORECAST_INPUT_FORMAT` 분기 제거 완료.
- [x] **COMPUTE_BASE_URL** (2026-10-14 `/v1/health` 핑 반영 완료 — P3 D-5): 포트 9000은 `.env`/`.env.example`에 반영됨. `GET /v1/health` 핑 체크를 `GET /api/health`의 compute 상태에 반영하는 건 **아직 안 됨** — `apps/relay/src/routes/health.ts`가 여전히 `compute: 'disconnected'` 고정값(주석도 "M4/M8에서 붙는다"로 구식). 남은 작업.
- [x] **geometry 반영**: 온도 측 2026-10-08 v2 제공 `geometry.json`(room 칸막이·급기구 3개·배기구·센서 8개 위치 포함, 125개 포인트 실측 좌표)을 `config/geometry.json`에 반영 완료(2026-10-09). `scene/layout.ts`의 임시값은 메인 화면이 실측 glb 모델(`weaner_room_test-001.glb`)로 교체되면서 더 이상 렌더링에 쓰이지 않아 치수만 참고용으로 남겨둠(육성·비육 치수는 여전히 미확정, 05-open-questions #18).
- [x] **농장 위경도**: `.env`에 `FARM_LAT=33.446297`·`FARM_LON=126.563879`·`KMA_NX=53`·`KMA_NY=37` 반영 완료, 온도 측 값과 일치.
- [x] **M6(전문가 모드)**: 온도 측 2026-10-08 v2 제공 `mock/mock_expert.json`을 relay가 읽어 변환해 반환하도록 구현 완료. 입력값은 그대로 echo, 결과(frames)는 입력과 무관하게 동일(확인된 설계대로).
- [x] **M6(제어 모드)**: 온도 측 2026-10-08 v2 제공 `mock/mock_control.json`(`target:"energy"` 시나리오 하나)을 relay가 읽어 변환해 반환. `target=environment` 요청도 같은 파일을 쓰고 응답 `target` 필드만 요청값으로 덮어씀(05-open-questions #27, 파일 하나로 충분하다는 확정과 일치). `control` 블록(절감률·곡선) C안 화면까지 구현 완료.
- [x] **WIND/날씨 변환** (2026-10-14 풍속 `CURWIND` 반영 완료 — 아래 P1 '외부환경 풍속·강수량'): `WIND` 0~360 숫자 → 16방위 변환은 구현됨(`windDirection.ts`). 미세기후 weatherCode의 "RAIN > 0이면 시간 무관 RAIN" 규칙도 구현됨(`weatherCode.ts`). 풍속은 `StationWeather.windSpeed`(`CURWIND`, `MAXWIND`는 쓰지 않음)로 3-2 화면 타일에 표시.
- [x] **EXPERT_INPUT_RANGE**: `EXPERT_TEMP_MIN/MAX`(−30~50)·`EXPERT_RH_MIN/MAX`(0~100)·`EXPERT_VENT_MIN/MAX`(20~100)로 `.env`/`env.ts`/대시보드 상수에 반영 완료.

## 2026-10-13 디자인 시안 검토 답변 반영 — 할 일

`디자인시안_검토_답변및수정요청_20261013.docx`(A 답변 3건 / B 수정 요청 10건 / C 진행 현황 / D 연산 서버 인터페이스 확정안)와
`연산서버_예시데이터_v3_20261013.zip` 검토 결과. 회신 내용은 `docs/replies/20261013-디자인시안검토-회신.md`.
아래 순서(P0 → P4)대로 진행한다. P0 항목은 서로 독립이라 묶어서 처리해도 된다.

### P0. 즉시 반영 (독립 항목, 상위 서버 변경 없음)

- [x] **A-1 센서 조회 시각 14자리** — `apps/relay/src/utils/time.ts`의 `formatKstWallClockCompact`가 `YYYYMMDDHHmm`(12자리)를 만든다. 센서 서버는 14자리로 읽어 분·초가 밀린다(09:50 → 09:05). `YYYYMMDDHHmmss`로 고치고 테스트 갱신. **이후 `.env`의 `SENSOR_HISTORY_MODE`를 비워 live로 되돌리고 3시간 이력 조회를 확인한다**(05-open-questions #34 종결).
- [x] **A-2·B-5 환기팬 가동률 클램프** — `transforms/aggregate5min.ts`의 `clampRange`는 범위 밖 값을 `null`(결측)로 만든다. 온도 측 요청은 "결측으로 보지 말고 값만 자르기"(172.5 → 100, 0 미만 → 0)다. 지금 동작은 이상치가 잦으면 센서 오류로 판정돼 연산 서버를 호출하지 않는 문제가 있다. `AggregateThresholds`에 범위 밖 처리 방식(`'null' | 'clamp'`)을 추가해 팬만 `clamp`로 쓴다. 온·습도는 기존 `null` 유지(B-3 적용 후 센서 입력에서 빠지므로 영향 없음).
- [x] **v3 목업 파일 교체** — `mock/`의 `sample_response_current.json`·`sample_response_forecast.json`·`mock_expert.json`·`mock_control.json`을 v3로 교체. `sample_request_*.json`도 갱신본으로 교체. `geometry.json`은 v2와 동일해 교체 불필요. `mock/README.md`도 v3 기준으로 갱신.
- [x] **v3 `range`·`geometryId` 통과** — `clients/computeClient.ts`의 `computeOkSchema`가 `range`·`geometryId`·`forecast_issued_at`을 정의하지 않아 조용히 버린다. 스키마에 추가하고, `transforms/detailTransform.ts`가 전 프레임을 훑어 직접 계산하던 `range`를 **응답 값 그대로 쓰도록 변경**(응답에 없을 때만 기존 계산을 폴백으로). `range.flow.max`는 급기구 극값을 뺀 95퍼센타일이라 우리 계산값을 쓰면 유동 색이 단색으로 뭉개진다. `geometryId`가 `pig-nh-v1`과 다르면 `UPSTREAM_ERROR`.
- [x] **A-3 유동 표현 되돌림** — `config/constants.ts`의 `FLOW_VISUALIZATION_MODE`를 `'grid-cylinders'`로. 온도 측이 "스트림튜브 추적 불필요, 288점 화살표"로 확정(05-open-questions #40 종결). `scene/FlowCylinders.tsx`는 머리 없는 실린더라 **화살촉(cone)을 붙여 화살표로** 만든다(방향 = `vx,vy,vz`, 길이·색 = `value`). 288점 해상도는 그대로 — 그 데이터로 그린 그림을 온도 측이 확인했다.
- [x] **B-1 포인트 토글 기본값** — `store/detailStore.ts`의 `pointsVisible`이 전 모드 `true`다. 예측·전문가·제어는 **기본 꺼짐**, 현재 모드는 그대로. `setMode()`에서 모드별 기본값을 세팅한다.
- [x] **B-7 타임라인 실제 시각** — `components/detail/Timeline.tsx` 하단 라벨이 `"00:00"`·`"… / 24:00"` 하드코딩이다. `frames[0].time` ~ `frames[frames.length-1].time`의 실제 시각(날짜 포함)으로 바꾸고 프레임 0에 '현재' 표시. 05-open-questions #37·#38 종결.
- [x] **B-9 2D x축 끝값** — `Detail2DSection.tsx`의 `niceAxisTicks(0, 4.5)`가 0·1·2·3·4로 끝난다. 방 폭 끝 **4.5 m**가 보이게 한다(`detail/axisTicks.ts`에 끝값 포함 옵션 추가 + 테스트).
- [x] **B-9 2D y축 방향 — 2026-10-14 재검토로 수정(y = 0이 아래)**. 2026-10-13에는 "3D도 y가 커질수록 화면 아래라 2D와 같다"며 뒤집지 않았으나, 3D 자체가 **거울상**이었다: `scene/coords.ts`의 `(x, y, z) → (x, z, y)`는 축 맞바꾸기라 회전이 아니라 반사다. 돈방 모델 `p1.glb`는 처음부터 `(x, z, −y)`로 만들어져 있어(배기구 z≈0, 급기구 z = −0.8/−1.98/−3.15, 칸막이 갈림 z = −3.62) 데이터 포인트·등치면·유동만 모델과 반대쪽에 겹쳐 그려지고 있었다(칸막이가 x 방향으로 거의 대칭이라 눈에 덜 띄었다). 상세보기만 `(x, z, −y)` 회전으로 고치고(방 박스 z −d~0, 카메라는 그대로 +z 쪽 = 배기구 벽 앞, 메인 화면은 영향 없음), 2D도 온도 측 평면도(그림 1)처럼 y = 0이 아래로 뒤집었다(`heatmapImage.ts`·칸막이 SVG·y 눈금). 데이터 좌표(원점 = 배기구 벽 서쪽 바닥 모서리)는 그대로다.
- [x] **B-10 제어 카드 라벨** — `components/detail/ControlSummaryCard.tsx`의 `'팬 절감률 (kWh)'` → `'팬 전력량 (kWh)'`. 카드 값은 이미 `control` 블록에서 읽으므로 시안의 75 %가 아니라 파일 값(38.2)이 맞다 — 변경 없음.
- [x] **토글·포인트 색 `#00bd55`** — `apps/dashboard/src/index.css`의 `--color-ondo-accent-on`이 `#22c55e`인데, 이 값은 저희가 디자인 이미지에서 눈대중으로 뽑은 근사값이다(06-design-guide.md 1장 제목에 명시). Figma 시안의 `#00bd55`가 정본이므로 교체하고 `docs/06-design-guide.md`도 갱신. 05-open-questions #41 ② 종결.

### P0-추가. 현재·예측 모드가 응답 파일을 읽게 하기 (C)

작업 중 발견한 누락. 온도 측 C: "연산 서버가 열리기 전까지는 **응답 파일을 연산 서버 대신 읽어**(명세의 `COMPUTE_MODE=mock`) 두 화면을 구현해 주시면 감사하겠습니다."

- [x] **`COMPUTE_MODE`에 파일 읽기 모드 추가** (2026-10-13 완료, 커밋 `9cafa52` — **사용자 결정: 데이터는 온도 측 응답 파일 값 그대로, 시각만 현재 기준으로 다시 깐다**(`transforms/mockRebaseTime.ts`). 별도 `file` 모드를 만들지 않고 `COMPUTE_MODE=mock`이 파일을 1순위로 읽고 없으면 합성 생성기로 폴백. 연산 서버 연결(`COMPUTE_MODE=http`) 시 같은 v3 응답 형식을 오류 없이 받는지 `clients/computeClient.test.ts`에서 두 응답 파일로 검증(2026-10-14)) — 지금 `COMPUTE_MODE=mock`은 `clients/mockComputeClient.ts`가 `transforms/mockComputeGen.ts`로 프레임을 **합성**한다(파일을 읽지 않는다). 그래서 `mock/sample_response_current.json`·`sample_response_forecast.json`은 아무 데서도 쓰이지 않고, **v3의 `range`도 현재·예측 모드에는 적용되지 않는다**(전문가·제어는 목업 파일을 읽으므로 이미 적용됨).
  - `COMPUTE_MODE=file`(가칭)을 추가해 두 응답 파일을 읽어 그대로 돌려주게 한다. 기존 `mock`(합성)은 그대로 남긴다 — 합성 생성기는 입력 시각에 맞춰 프레임을 만들어 주는 장점이 있고 단위 테스트도 붙어 있다.
  - **트레이드오프(✅ 위 사용자 결정으로 해소)**: 파일을 읽으면 화면 시각이 파일 기준(`2026-10-05`)으로 고정된다. 전문가·제어 모드가 이미 그렇게 동작하므로 일관성은 있지만, 현재·예측 모드는 "지금"을 보여주는 화면이라 어색할 수 있다. 어느 쪽을 기본값으로 둘지 확인 후 진행.

### P1. 중계 서버 입력 전환 (B-3·B-4)

- [x] **B-4 fan_pct 계단표** (2026-10-14 완료 — `.env`의 `FAN_STEP_TEMPS`·`FAN_STEP_PCTS`) — `transforms/forecastInterpolate.ts`의 `fanPctFromTemp`가 선형 램프(`clamp(20 + 80×(T−22)/8)`)다. **5단 계단표**로 교체: 22 ℃ 미만 20 % / 22~24 40 % / 24~26 60 % / 26~28 80 % / 28 ℃ 이상 100 %(경계값은 아래쪽 포함). `.env`·`.env.example`의 `FAN_T_LOW`·`FAN_T_HIGH`·`FAN_MIN`·`FAN_MAX`를 계단표 설정으로 교체하고 `config/env.ts` 반영. 경계값 단위 테스트 필수.
- [x] **B-3 과거 3시간 외기 온·습도를 기상청으로** (2026-10-14 완료 — `transforms/outdoorHistory.ts`, `routes/measuredInputs.ts`, `.env`의 `SENSOR_HISTORY_MODE`는 비워 live로 되돌림) — 지금은 센서 `JE/OU/WS/WS1/TEMP`·`RH`를 쓴다(`routes/detailCurrent.ts`·`detailForecast.ts`). 기상청 초단기실황(`getUltraSrtNcst`, nx 53 / ny 37, `T1H`·`REH`)으로 전환한다.
  - `clients/kmaClient.ts`에 **과거 정시 실황 조회**를 추가한다. 매시간 적재 방식이 아니라 `base_date`/`base_time`에 과거 정시를 넣어 최근 정시 4회를 그때그때 조회한다(회신문 2장 — 재시작 직후에도 과거 3시간 복구 가능). 단기예보와 같은 서비스·같은 인증키라 추가 발급 불필요.
  - 정시 4개 → 5분 간격 선형 보간 + **마지막 관측 이후는 마지막 값 유지**를 순수 함수로 분리하고 단위 테스트(자정 넘김 포함).
  - 결측 1개는 보간, **2개 이상 연속이면 '기상청 실황 조회 실패'** 로 연산 서버를 호출하지 않는다. 이때 예측 모드도 함께 중단된다(실측 구간 입력을 만들 수 없어 D-2의 "실측 2.5시간 미만"에 걸림) — 두 모드에 같은 문구를 띄운다.
  - `.env`·`.env.example`의 `INPUT_T_OUT_PATH`·`INPUT_RH_OUT_PATH` 폐기. 센서 입력은 `INPUT_FAN_PATH`(`JE/EX/NH/FN1/FAN1`)만 남는다.
  - 미래 24시간은 기존 단기예보 유지, 화면의 미세기후 패널은 기상대 값 유지(변경 없음).
- [x] **단기예보 발표분 재시도 단계 늘리기** (2026-10-14 완료 — `.env`의 `KMA_VILAGE_MAX_STEPS_BACK`. **2026-10-15 온도 측 확정으로 기본값 2 → 3단계(최대 9시간 전 발표분)**: 단기예보는 발표 시각부터 이틀 이상을 담아 9시간 전 발표분으로도 24시간을 채울 수 있고, 화면이 비는 것보다 조금 이전 예보로라도 보여주는 편이 낫다. 2026-10-14 실측에서도 오래된 발표분이 3~4일치를 담고 있어 17시 발표분으로 24시간이 채워졌다. 거슬러 올라간 발표분임을 화면에 표시하지는 않는다 — 05-open-questions #50) — `clients/kmaClient.ts`가 `NO_DATA`면 직전 발표분으로 **1회만** 재요청한다. **2026-10-13 23:30 실측에서 23:00·20:00 발표분이 연속으로 `NO_DATA`였고 유효한 최신 발표분은 17:00(TMP 83건)이었다** — 발표 시각(02·05·08·11·14·17·20·23시)은 맞지만 실제 제공이 늦어 두 단계가 비는 경우가 있다. `detailForecast.ts`가 `startStepsBack=1`로 한 번 더 시도해도 20:00이라 역시 비어서, 지금 그대로면 예측 모드가 "기상청 예보 조회 실패"로 막힌다. 재시도를 2~3단계까지 내려가게 고치고(최대 단계는 `.env`로), 그 단계 수로 24시간을 채울 수 있는지 함께 확인한다. 발표분이 오래될수록 예보 시작 시각이 과거라 24시간 구간을 못 채울 수 있다. 참고: 키·실황은 정상 확인됨(초단기실황 `resultCode=00`, 과거 정시 조회도 정상).
- [x] **외부환경 풍속·강수량 채우기** (2026-10-14 완료 — 기상대 `CURWIND` 단위는 2026-10-15 **m/s로 확정**, 표시 그대로 유지. 05-open-questions #43) (05-open-questions #36) — 타일 4칸 중 풍속·강수량이 `-`로 비어 있다. **출처는 추가 조회 없이 이미 있는 응답에서 꺼내면 된다.** 온도 측 회신이 필요한 사항이 아니므로 바로 구현한다.
  - 기상청: `routes/mainWeatherKma.ts`가 초단기실황에서 `T1H`·`REH`·`VEC`·`PTY`만 읽는다 → 같은 응답의 **`WSD`(풍속 m/s)·`RN1`(1시간 강수량 mm)** 추가.
  - 기상대: `routes/mainWeatherStation.ts`가 `WIND`만 읽는다 → **`CURWIND`(현재 풍속)** 추가. 센서에 `MAXWIND`(최대 풍속)도 있으나 타일에는 현재값을 쓴다. 강수량 `RAIN`은 이미 읽고 있다.
  - `packages/shared`의 `KmaWeather`·`StationWeather`에 필드 추가 → 대시보드 타일 연결. `docs/02-relay-api.md` 4.2·4.3, `docs/03-upstream-apis.md` 기상청 항목표도 같이 갱신.

### P2. 전문가 모드 입력 24×3 표 (B-2)

- [x] **API 형식 변경** (2026-10-14 완료) — `GET /api/detail/expert?temp=&rh=&vent=`(값 3개)를 **`POST /api/detail/expert`** + 본문 `rows[24]{temp, rh, vent}`로 바꾼다. `packages/shared`의 `ExpertDetail.input` 타입 변경(양쪽에서 import, 앱 안에 복제 금지). `routes/detailExpert.ts`의 검증을 24행·빈칸 불허·범위(−30~50 / 0~100 / 20~100)로 교체.
- [x] **입력 표 UI** (2026-10-14 완료, 표 레이아웃은 05-open-questions #44) — `components/detail/ExpertInputForm.tsx`를 24행 × 3열 표로 교체. 행 = 1시간 간격 24개, **첫 행 = 현재 시각 다음 정시**. 예시 값은 `mock_expert.json`의 `input` 정시 값 24개(2026-10-05 16:00 ~ 10-06 15:00, 실제로 24개 확인)를 순서대로 채운다 — "예시 값"이므로 행 라벨 시각과 값의 원래 시각이 어긋나는 것은 무시한다. 환기량 단위는 **가동률 %**(시안의 'cmm' 폐기, 05-open-questions #41 ① 종결).
- [x] **검증·연동** (2026-10-14 완료) — `detail/expertInputValidation.ts`를 24행 검증으로 교체(+테스트), `api/endpoints.ts`·`components/detail/ExpertModeView.tsx` 연동. '적용' 시 입력값과 무관하게 목업 결과가 나오는 동작은 그대로 유지한다.

### P3. 3D 범례·오류 처리·헬스체크

- [x] **B-8 3D 색 막대** (2026-10-14 완료 — 공용 `ColorLegend.tsx`, 3D 좌상단 오버레이. 위치는 시안 없어 임의, 05 #46) — 3D·2D는 이미 같은 색상표(`detail/colormap.ts`)와 같은 `range`를 쓴다. **3D에 색 범례가 없는 것만** 추가한다. `Detail2DSection.tsx`의 범례(그라데이션 막대 + `niceAxisTicks` 눈금)를 공용 컴포넌트로 뽑아 `Detail3DView`에도 얹는다.
- [x] **D-4 오류 코드별 처리** (2026-10-14 완료 — relay `clients/computeRetry.ts`, 대시보드 현재 모드는 연산 실패 시 마지막 정상 결과 유지 + 상단 안내(`detail/keepLastGood.ts`). 예측 모드는 탭 선택 시 1회 호출이라 유지할 이전 결과가 없어 해당 없음. BUSY 재시도 횟수는 05 #45) — `clients/computeClient.ts`의 `computeErrSchema`가 `message`만 읽고 `code`가 없다. 재시도 로직도 전혀 없다. `code`(`BAD_REQUEST`/`SERVER`/`BUSY`)·`field`를 파싱하고 회신대로 처리: `BAD_REQUEST`는 표시만, `SERVER`는 1분 뒤 1회 재시도 후 '예측 서버 오류', `BUSY`는 1분 뒤 재시도, 타임아웃은 '예측 서버 연결 안 됨' + 마지막 정상 결과 유지.
- [x] **D-5 `/v1/health` 핑** (2026-10-14 완료 — `ComputeClient.ping()`, mock은 항상 ok, 핑 타임아웃은 `UPSTREAM_TIMEOUT_MS`) — `routes/health.ts`가 `compute: 'disconnected'` 고정값이다(2026-10-07 섹션의 미완 항목). `GET /v1/health` 결과를 `GET /api/health`의 compute 상태에 반영.

### P5. 전문가 모드 디자인 시안 반영 (2026-10-17 사용자 지적 — 남은 작업)

- [x] **새 시안 6장 반영 완료**(2026-10-17, `docs/design/UI/전문가 모드 새 디자인/03_전문가모드_디자인_01~05.png`).
  2026-10-10 재확인본의 미확인 6개 노드를 기다릴 필요가 없어졌다 — 사용자가 24행 표 기준 새 시안을
  PNG로 전달해 Figma 월 호출 한도와 무관하게 진행했다(05-open-questions.md #41 ③ 해소). 반영 내용:
  - **입력 화면과 결과 화면을 분리**했다(가장 큰 변경). 전에는 높이 206px 입력 표가 결과 위에 상시
    붙어 있었는데, 시안은 입력 표가 패널 전체를 차지하는 화면(01~04-1)이고 결과 화면(05)에는
    "필수값 설정 … [필수값 수정]" 한 줄만 남는다. `[필수값 수정]` ↔ `[<]`로 오가고, 적용에 성공하면
    자동으로 결과 화면으로 넘어간다(`ExpertModeView.tsx`의 `screen` 상태, `ExpertResultHeader.tsx` 신규).
  - **행 라벨 `0시~23시`** — 전에는 "현재 시각 다음 정시"부터였다. 온도 측이 시안에서 이 부분을
    설명하지 않아 문의 대상으로 남겼다(05-open-questions.md #51).
  - **빈 칸으로 시작** + placeholder "값을 입력해주세요." — 전에는 `mock_expert.json` 예시값 24개를
    미리 채웠다(05-open-questions.md #44 종결).
  - **`초기화` 버튼** 추가(값을 하나라도 적어야 나타남, 시안 02). `적용`은 전 칸 유효일 때만 활성.
  - **오류를 칸별 인라인 문구로** — 전에는 표 아래 첫 오류 하나만 보여 줬다(시안 03).
  - **포인트 표시 토글 기본 켜짐**(전문가 모드만) — 시안 05가 켜진 상태다. B-1("예측·전문가·제어
    기본 꺼짐")과 어긋나지만 사용자 확인으로 시안을 따랐다(`store/detailStore.ts`).
  - **결과 타임라인 라벨을 `00:00~24:00`**(전문가 모드만, `Timeline.tsx`의 `elapsedLabels`).
    입력 표의 0시~23시 축과 맞춘 것이다. B-7(#37·#38)은 예측 모드 타임라인에 대한 요청이었으므로
    예측·제어는 그대로 실제 시각을 쓴다.
  - `적용` 버튼 색(`#1088de`)·오류 문구 형식은 기존 구현이 이미 시안과 같아 변경 없음.

### P4. 3D 모델링 (일부 자료 대기)

- [ ] **B-6 급기구를 천장면 2D 사각형으로** — 천장에 매달린 직육면체가 아니라 천장면의 2D 사각형(0.32 × 0.687 m). `geometry.json`의 `room.inlets`에 좌표·크기(`z = 2.8`, `w`·`l`)가 이미 있는데 렌더링 코드가 없다(p1.glb 내장분에 의존). **참고 사진과 무관하게 먼저 진행 가능.**
- [ ] **B-6·C 돈방 내부 디테일** — 실제 돈방 사진 기준으로 내부를 돈방처럼 수정. **참고 사진 수신 대기**(온도 측이 "별도로 보내드리겠다"고 했으므로 따로 요청하지 않음).
- [ ] **C 돼지 크기 차등·돈방별 돼지 수** — 2026-10-14 온도 회신: **세 방 모두 19두**, 크기 **자돈 1 : 육성 1.4 : 비육 1.8**, 체형은 성돈형. 배치 코드는 준비돼 있으나(`scene/roomPigs.ts` `ROOM_PIG_SCALE`·`buildRoomPigs`, `scene/pigLayout.ts` 격자 — 육성 4열×5줄, 비육 3열×7줄로 19두가 방 안에 들어가는 것까지 실제 모델로 확인) **성돈 모델 수신 대기로 화면에는 붙이지 않았다**(2026-10-14 사용자: 모델을 구해 전달 예정, 05-open-questions.md #48). 모델을 받으면 `OverviewScene.tsx`에서 `buildRoomPigs(scene, computed)` 한 줄을 되살린다.

### 문서 동기화

- [x] **`docs/01-functional-spec.md`** (2026-10-17 완료) — 3장 표의 포인트 on/off를 모드별 기본값(현재 on, 예측·전문가·제어 off)으로, 색 범례를 3D·2D 공용(`ColorLegend`, 3D는 오른쪽 가운데 56×180)으로 추가, `range`가 연산 서버 응답 값임을 명시. 전문가 입력 24행은 4.3절에 이미 반영돼 있었다. 겸해서 2D 단면 줄의 "단면 높이 미확정 / 현재 모드 2D 필요한지 확인 중"을 확정 내용(05 #15·#16)으로 고쳤다.
- [x] **`docs/02-relay-api.md`** (2026-10-17 완료) — `range` 출처(연산 서버 응답 값 그대로 통과, 없을 때만 폴백, 95퍼센타일 주의)를 5장에 추가하고 `DetailBase.range` 주석도 갱신. 겸해서 유동 줄의 "표현 방식 미확정(#40)"을 288개 화살표 확정으로 고쳤다. expert POST + `rows[24]`와 4.2·4.3 풍속·강수량 필드는 이미 반영돼 있었다.
- [x] **`docs/03-upstream-apis.md`** (2026-10-17 확인 — 네 항목 모두 P1 작업 때 이미 반영됨) — fan_pct 5단 계단표(4.1절, 직선식은 "폐기" 표기만 남김), 과거 3시간 외기 출처 = 기상청 초단기실황(1장 주의·2장·4.1), 기상청 항목표 `WSD`·`RN1`, 1장 기상대 항목 `CURWIND`(단위 m/s 명시, "무시" 목록에서 제외). 문서 변경 없음.
- [x] **`docs/05-open-questions.md`** (2026-10-17 완료) — #34·#36·#37·#38·#40·#41 ①② 종결 표기는 각 작업 때 이미 들어가 있었다. 남아 있던 모순 두 곳만 정리: #41에서 같은 칸 앞부분이 `#00bd55` 종결인데 뒤에 "일단 기존 `#22c55e` 유지"가 남아 있던 문장 삭제, #46의 3D 범례 위치를 실제 구현대로 좌상단 → 오른쪽 가운데(56×180)로 수정. 신규 항목 없음.
- [x] **`docs/06-design-guide.md`** (2026-10-17 확인 — P0 `#00bd55` 작업 때 이미 반영됨, 1장 색상 토큰표 `accent-on`). 문서 변경 없음.
- [x] **`.env.example`** — `FAN_T_*` → 계단표 설정, `INPUT_T_OUT_PATH`·`INPUT_RH_OUT_PATH` 제거.
- [x] **`CLAUDE.md`** (2026-10-17 확인 — P1 작업 때 이미 반영됨: "환기량은 FAN1 가동률(%) 하나만" 항목에 5단 구간 표와 직선 보간식 폐기, 별도 항목으로 과거 외기 온·습도 = 기상청 초단기실황). 문서 변경 없음.

### 보류 — 사용자 확인 필요

- [ ] **`scene/FlowStreamlines.tsx`·`detail/flowStreamline.ts` 삭제 여부** — A-3으로 불필요해졌지만 지우기 전에 확인받는다. 남겨두면 `FLOW_VISUALIZATION_MODE` 분기도 함께 유지된다.

## M0. 저장소 기본 구성

- npm workspaces 모노레포: `apps/dashboard`, `apps/relay`, `packages/shared`, `mock/`.
- dashboard: Vite + React + TypeScript + `@react-three/fiber` + `@react-three/drei` + zustand. `/api` 프록시 → `http://localhost:8080`.
- relay: Node 20 + TypeScript + Fastify + pino + `@fastify/static`. 설정은 `dotenv` + zod로 검증(누락·형식 오류 시 시작 실패와 명확한 메시지).
- shared: `02-relay-api.md`의 타입 전체.
- vitest, eslint, prettier. 루트 스크립트: `dev`, `build`, `start`, `test`, `lint`, `typecheck`, `mock:generate`, `grid`(위경도 → 격자 변환).
- `.env.example` 작성(키 목록은 저장소 루트의 `.env.example` 참고).

완료 조건: `npm run dev`로 relay와 dashboard가 함께 뜨고, dashboard 화면에서 `/api/health` 응답이 보인다.

## M1. 중계 서버: 메인 요약

- `SensorClient.latest(path)`: 응답 파싱(중첩 경로 탐색, 키 기반 항목 조회, timestamp에 +09:00).
- `KmaClient`: 초단기실황, 초단기예보, 단기예보. 발표 시각 계산, NO_DATA 시 직전 발표분 재요청, XML 오류 응답 처리.
- 변환 함수: 16방위, 미세기후 날씨 판정, PTY/SKY 문구, 3-1 날씨 결정.
- `GET /api/main/rooms`(6개 센서 경로, 방 단위 partial), `GET /api/main/weather/kma`(초단기실황+초단기예보, 발표 시각 캐시), `GET /api/main/weather/station`(WS1). 날씨 코드·isNight(suncalc).
- `GET /api/health`.
- 단위 테스트: 변환 함수 전부, 발표 시각 계산(자정 넘김 포함), 센서 응답 파싱(항목 순서 뒤섞인 픽스처, 항목 누락 픽스처), rooms partial.
- `SENSOR_MODE=mock` 옵션: 센서 서버에 접근할 수 없는 환경에서도 개발할 수 있게 픽스처를 반환.
- `SENSOR_HISTORY_MODE`(선택): 현재·예측 입력 이력만 따로 mock/live 지정. 비우면 `SENSOR_MODE`를 따름(05-open-questions #34).

완료 조건: 실제 센서 서버·기상청에 붙여 세 API가 응답한다. 센서 하나를 막으면 해당 방만 disconnected, 기상청을 막으면 3-1만 끊김.

## M2. 대시보드: 메인 화면

- 1920×1080 레이아웃 영역 컴포넌트: Header(로고·시계), OutdoorPanel(3-1, 3-2), MainScene(3D), ScaleBar, DetailPanel 자리.
- 3D 돈사: 박스형 3개 방(자돈 90도 회전), 급기구(사각 팬 3개)·배기구(원형 팬 1개)·Y형 내부 칸막이, 머티리얼 3종, 육성·비육 회색. 치수·배치는 `apps/dashboard/src/scene/layout.ts` 상수로 분리.
- 돼지: 단일 모델(임시로 단순 형상 가능, 추후 glTF 교체), 핑크/회색, 스케일 차이만. InstancedMesh.
- 방 호버 → 정보 판넬(온도·습도·환기량(FAN1 %)·NH3·CO2, 단위 포함). 3개 방 모두. disconnected면 끊김 표시.
- 클릭은 자돈방만 반응(커서 pointer). 회색 방은 커서 기본, 클릭 핸들러 없음. 방별 `interactive` 플래그로 관리.
- 축척: 카메라 줌에 따라 막대 길이·라벨(m) 갱신.
- `usePolling(fetcher, intervalMs)`: 즉시 1회 + 10분 주기, 탭 비활성 시에도 유지, 언마운트 시 정리.
- 로딩바: 3D 모델·첫 데이터 로딩 동안 표시.

완료 조건: 실제 데이터로 3개 방 호버 정보와 외부환경(날씨 아이콘 포함)이 표시되고, 영역별 끊김이 따로 동작한다. 브라우저 성능 탭에서 첫 로딩 5초 이내.

## M3. 대시보드: 상세 패널 공통

- 모드 탭(현재 기본), 유동/습도/온도 토글(기본 온도), 포인트 on/off(기본 on).
- 3D 자돈방 뷰: 125개 포인트 InstancedMesh, 값→색상(범례와 같은 컬러맵), 호버 툴팁(X, Y, Z, VALUE), 유동 선택 시 호버 포인트에 방향 화살표.
- 2D 수평단면: grid에서 `SECTION_Z_M` 층 → 2배 쌍선형 보간 → canvas 히트맵 + 우측 그라데이션 범례(min/max 라벨). 현재 모드 2D는 `SHOW_2D_IN_CURRENT` 플래그.
- 좌표 변환(데이터 z-up → Three.js y-up)은 `scene/coords.ts` 한 곳에서만.
- 컬러맵·보간·포인트 선택 로직은 순수 함수로 분리하고 테스트.

- relay: `GET /api/detail/geometry`(`GEOMETRY_FILE` 로드·zod 검증, 파일 없으면 시작 실패). `config/geometry.json` 기본 파일(PINN v17.0 치수, grid 19×17×8, flowGrid 9×8×4, 포인트 5×5×5 임시).
- dashboard: 상세 첫 진입 시 geometry 1회 요청 후 store 보관, 상세 응답 geometryId가 다르면 재요청.

완료 조건: 픽스처 데이터(`Geometry` + `CurrentDetail`)로 버튼 전환, on/off, 호버, 2D 히트맵이 동작한다.

## M4. 현재 모드

- relay: `SensorHistoryClient`(3개 항목, 181 슬롯 배치, 빈 분 null, 반올림 금지), 10분 단위 정각 구간 계산, `/v1/current` 요청 빌더, `ComputeClient`(mock/http, API Key 헤더), 응답 변환기(range·타임존·offsetMin·geometryId 부착·배열 개수 검증 125/2,584/288), 끝 시각(10분 단위) 캐시, `GET /api/detail/current`.
- dashboard: 상세 진입 시 메인 API들과 동시 호출, 현재 모드 유지 중 10분 주기.

완료 조건: `COMPUTE_MODE=mock`으로 현재 모드 화면이 끝까지 동작한다.

## M5. 예측 모드 + 타임라인

- relay: 단기예보 1분 확장(1,440건, fan_pct null) + 실측 181건 = 1,621건 series 빌더(기본), summary 빌더(연동명세서 v1.0 형식, `FORECAST_INPUT_FORMAT`로 전환), `/v1/forecast` 요청, `GET /api/detail/forecast`.
- dashboard 타임라인: 재생/일시정지/정지, 10분 눈금, 드래그 이동, 현재 프레임 시각 표시, 재생 속도 상수. 3D·2D가 같은 프레임.
- 재생형 3D 표현: 온도·습도 = grid 2배 보간 + marching cubes 등치면 3~5단계(반투명, Worker에서 프레임별 미리 계산·캐시), 유동 = flowGrid 실린더 InstancedMesh(방향·길이·색상 = vx,vy,vz,value, 행렬·색상 버퍼만 갱신).

완료 조건: 예측 탭에서 24시간 재생이 끊김 없이 동작한다(60fps 목표, 최소 30fps).

## M6. 전문가·제어 모드

- relay: `GET /api/detail/expert`(입력 검증, 400), `GET /api/detail/control`(target), `mock/` 파일 로더, `npm run mock:generate`.
- dashboard 전문가: 온도·습도·환기량 입력 + 확인, 입력 전 빈 상태("데이터 값을 입력해주세요", 호버 UI 없음), 입력 오류 표시.
- dashboard 제어: 에너지/환경 최적화 버튼(기본 에너지), 전환 시 재호출.

완료 조건: 두 모드 모두 목업으로 타임라인 재생까지 동작한다.

## M7. 오류 처리·성능·이관 패키징 — **2026-10-23 온도 측 무인 테스트 대응으로 재구성**

원래 M7은 "새 Windows PC에서 README만 보고 실행된다"까지였다. 2026-10-17 사용자 전달 사항으로
전제가 바뀌어 아래와 같이 다시 잡는다.

**전제**
- **2026-10-23에 온도 측으로 소스를 전달하고, 그때 사용자는 자리에 없다.** 테스트는 온도 측이 직접 한다.
  오류가 나도 사용자에게 피드백이 오지 않으므로, "사람이 보고 판단"하는 점검은 쓸 수 없다 —
  **스크립트가 ✅/❌와 원인·조치를 스스로 찍어줘야 한다.**
- 그때까지 **센서 서버·기상청·연산 서버 세 연동이 실제로 붙어야** 한다.
- **온도 측도 Claude Code를 쓴다.** 구동을 Claude에게 맡길 예정이라, 개발용 `CLAUDE.md`와 별도로
  **구동 전용 지시서**가 필요하다(개발용을 그대로 주면 Claude가 스펙 문서를 읽고 단계 작업을 하려 든다).
- **사용자는 없지만 온도 관계자(클라이언트)는 있다**(2026-10-17 보강). 그분들이 화면을 보고 직접
  클릭·인터랙션해 봐야 하므로, 점검이 `doctor` 출력만으로 끝나면 안 된다 — **화면 조작 항목**이 필요하다.
- **체크리스트는 두 독자가 같이 본다**: 온도 관계자(화면을 조작하고 증상을 적는 쪽)와 사용자(나중에 원인을
  고치는 쪽). 그래서 항목마다 **증상 → 온도 측에서 바로 할 수 있는 조치 / 개발자에게 넘길 기록**을 나눠 적는다.
- **연산 서버 IP는 전달 이후에 받는다.** `.env`를 직접 열어 고치게 하지 않고 값만 넣는 수단이 필요하다.

**2026-10-17 사용자 결정**
1. **기상청 서비스키는 전달 패키지에 `.env`를 포함해서 넘긴다.** git에는 계속 커밋하지 않는다
   (`.gitignore`의 `.env` 유지) — 전달물에만 넣는다. 온도 측이 키를 발급·입력할 일이 없어 실패 지점이 가장 적다.
2. **전달 패키지는 두 가지를 다 준비한다.** ① 빌드까지 끝낸 패키지(`node_modules`·`dist` 포함, Node 설치 후
   `start.bat`만 누르면 됨) ② 소스만 받은 경우용 `install.bat`(npm install + 빌드).
3. **전달 시점 `COMPUTE_MODE=mock`.** 연산 서버 IP를 몰라도 화면이 전부 떠서 센서·기상청 연동부터
   확인할 수 있고, IP를 받으면 `setup.bat`에서 `http`로 전환한다. 자동 폴백은 쓰지 않는다 —
   지금 보는 게 실제 계산인지 목업인지 헷갈리면 테스트 신뢰도가 떨어진다.

### M7-1. 운영 모드 구동 (기능 버그)

- [x] **`npm start`가 화면을 서빙하지 않는 버그**(2026-10-17 완료) — `apps/relay/src/index.ts`가
  `process.env.NODE_ENV === 'production'`일 때만 정적 서빙을 등록하는데, `npm start`(`node dist/index.js`)는
  `NODE_ENV`를 세우지 않는다. 지금 `npm start`를 하면 8080에 API만 뜨고 대시보드 화면은 안 나온다.
  **`NODE_ENV` 조건을 버리고 "`apps/dashboard/dist`가 있으면 서빙"으로 바꾼다** — 환경변수 하나를 빼먹어
  화면이 안 뜨는 함정을 없앤다. 뜰 때 로그에 어느 모드인지(정적 서빙 on/off, 접속 주소) 찍는다.
- [x] **시작 로그를 사람이 읽을 수 있게**(2026-10-17 완료) — 포트·접속 주소(`http://localhost:8080`)·`SENSOR_MODE`·`COMPUTE_MODE`를
  구동 직후 한 덩어리로 출력. 온도 측이 로그만 보고 지금 설정이 뭔지 알 수 있어야 한다.

### M7-2. 자가 진단 (`npm run doctor`)

사용자가 없어도 어디가 막혔는지 결과만 보면 알 수 있게 하는 것이 M7의 핵심이다.

- [x] **`npm run doctor`**(2026-10-17 완료 — `apps/relay/src/scripts/doctor.ts`. 실제 센서·기상청 + mock 연산으로 전 항목 통과 확인) — 상위 서버 셋을 각각 찔러보고 항목별로 `✅ 정상` / `❌ 실패`를 한국어로 출력한다.
  실패는 **원인과 조치**를 같이 적는다(예: "기상청 서비스키가 비어 있습니다 → `setup.bat`으로 키를 넣으세요").
  마지막에 전체 판정과 종료 코드(정상 0 / 실패 1)를 낸다.
  - `.env` 존재·필수값 검사(`SENSOR_BASE_URL`·`FARM_LAT`·`FARM_LON`·`KMA_NX`·`KMA_NY`가 없으면 서버가 아예
    안 뜨므로 **이것부터** 본다. `KMA_SERVICE_KEY`는 비어도 서버는 뜨고 기상청만 끊긴다)
  - 센서 서버: 최신값 6개 경로 + 환기팬 3시간 이력(14자리 시각, 181건 들어오는지)
  - 기상청: 초단기실황(`T1H`·`REH`·`VEC`·`PTY`·`WSD`·`RN1`) · 과거 정시 4회 · 단기예보 24시간 채워지는지
    (NO_DATA로 몇 단계 거슬러 올라갔는지도 표시)
  - 연산 서버: `COMPUTE_MODE`가 `http`면 `GET /v1/health` + `POST /v1/current` 실제 1회, `mock`이면 목업 파일 로드 확인
  - 상세 API 4개(`current`·`forecast`·`expert`·`control`)가 배열 개수(125 / 2,584 / 288)까지 맞게 오는지
- [x] **`check.bat`**(2026-10-17 완료 — 결과를 `점검결과.txt`로도 남긴다) — `npm run doctor`를 더블클릭으로 돌리고 결과를 창에 남긴다(바로 닫히지 않게).

### M7-3. 설정 입력 수단

- [x] **`setup.bat` + `npm run setup`**(2026-10-17 완료 — `apps/relay/src/scripts/setup.ts`, 순수 함수는 `utils/envFile.ts`로 분리해 테스트) — `.env`를 직접 열지 않고 값을 넣는 대화형 스크립트.
  최소 **기상청 서비스키**와 **연산 서버 주소(`COMPUTE_BASE_URL`)·`COMPUTE_MODE`**를 다룬다.
  기존 `.env`를 읽어 현재값을 보여주고, 엔터면 그대로 둔다. 저장 전 백업(`.env.bak`).
  **연산 서버 IP는 전달 이후에 받으므로 이 경로가 유일한 입력 수단이 된다.**
- [ ] **`.env`가 없을 때 안내** — 지금은 zod 검증 실패 메시지가 영어 스택으로 뜬다.
  `.env`가 아예 없으면 "`.env` 파일이 없습니다 → `setup.bat`을 먼저 실행하세요"로 먼저 끊어 준다.

### M7-4. Windows 실행 스크립트·패키징

- [x] **`start.bat`**(2026-10-17 완료) — 빌드 결과로 단일 포트 8080 구동 + 브라우저 자동 열기. 빌드가 없으면 먼저 빌드한다.
- [x] **`install.bat`**(2026-10-17 완료) — 소스만 받은 경우용(npm install → 빌드). 결정 2의 ②.
- [ ] **전달 패키지 만들기** — 빌드까지 끝낸 폴더를 그대로 압축하는 절차를 문서화(또는 스크립트).
  `.env` 포함(결정 1), `technical-review/`·`node_modules/.cache` 등 불필요한 건 제외.

### M7-5. 끊김 표시 점검

- [ ] **영역별 차단 테스트** — 센서·기상청·연산 서버를 각각 막았을 때 그 영역만 끊기고 나머지는 정상인지.
  라우트 단위 테스트는 있지만 "하나만 막혔을 때 나머지는 정상"을 고정하는 통합 테스트가 없다. 추가한다.

### M7-6. 온도 측 전달 문서

- [ ] **`README.md` 교체** — 지금 README는 스타터킷 시절 그대로(에이전트 사용법·M0~M8 진행 순서)다.
  온도 측 비개발자가 따라 할 수 있는 설치·실행·설정 문서로 교체한다(Node 설치 → 압축 풀기 → `start.bat` →
  접속 주소 → 안 될 때 `check.bat`). 개발용 내용은 `docs/`나 `CLAUDE.md`로 옮긴다.
- [ ] **`테스트-체크리스트.md`** — 온도 측이 순서대로 따라가며 결과를 적는 표. **두 부분으로 나눈다.**
  - **A. 자동 점검** — `check.bat` 한 번. 항목별 ✅/❌가 그대로 판정이다.
  - **B. 화면 조작** — 온도 관계자가 실제로 클릭·인터랙션하며 확인(2026-10-17 보강). 메인 3개 방 호버,
    자돈방 클릭 → 상세 진입, 모드 탭 4개, 온도/습도/유동 토글, 포인트 on/off, 3D 회전·줌, 포인트 호버 툴팁,
    2D 단면, 타임라인 재생·드래그·초기화, 전문가 24행 입력·적용, 제어 에너지/환경 전환. 각 항목은
    **"무엇이 보이면 정상인지"를 한 줄로** 적어 판단할 여지를 없앤다.
  - 항목마다 **증상별 대응을 두 칸으로** 나눈다: ① 온도 측에서 바로 할 수 있는 조치(`setup.bat`으로 키·IP 입력,
    `start.bat` 재실행, 연산 서버 켜기 등) ② 개발자(사용자)에게 넘길 기록(화면 문구 그대로, `check.bat` 출력,
    브라우저 F12 콘솔 오류, 발생 시각). 사용자가 없는 동안 오류를 재현할 근거가 그 기록뿐이다.
  - 맨 뒤에 **증상별 원인 대조표**를 붙인다 — 온도 관계자는 "이 증상이면 내가 뭘 하면 되는지", 사용자는
    "이 증상이면 코드 어디를 보면 되는지"를 같은 표에서 찾게 한다.
- [ ] **온도 측 Claude용 구동 지시서** — 온도 측도 Claude Code를 쓰므로, 구동·점검만 하도록 범위를 좁힌
  지시서를 전달 패키지 루트에 둔다(스펙 문서를 읽고 단계 작업을 시작하지 않게, 코드를 고치지 않게).

완료 조건: `.env`를 포함한 전달 패키지를 새 Windows PC에 풀고 **`start.bat` → `check.bat`** 두 번으로
구동·판정이 끝난다. `npm run doctor`가 센서·기상청·연산 서버 각각의 상태를 원인까지 찍어 준다.
사용자 없이 온도 관계자가 체크리스트만으로 화면 조작 테스트까지 마치고, 오류가 나면 증상별 대응표대로
자기 쪽 조치를 하거나 사용자에게 넘길 기록을 남길 수 있다.

## M8. 연산 서버 실제 연동 (형식 확정 후)

- `HttpComputeClient` 구현, `COMPUTE_MODE=http` 전환, 타임아웃 값 확정.
- 온도에서 받은 125개 포인트 좌표를 `geometry.json`에 반영.
