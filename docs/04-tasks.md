# 04. 작업 단계

계약 기간 1개월차(돈사 대시보드) 기준. 단계마다 완료 조건을 확인하고 요약 보고 후 다음 단계로 넘어간다. 공통 완료 조건: `npm run typecheck && npm test && npm run lint` 통과.

## 2026-10-07 중계 서버 명세서 답변 반영 — 할 일

`중계서버_명세서_v001_확인사항_답변_20261007.docx`(온도 예측 모델 담당 회신)와 `연산서버_첨부파일_20261007.zip`(geometry.json, sample_request/response, mock_expert.json, mock_control_energy.json, mock_control_environment.json) 검토 결과. 해결된 미확정 사항은 `docs/05-open-questions.md`에 반영 완료(1~6, 8~9, 11~16, 7·18 부분). 아래는 코드·문서에 실제 반영해야 할 작업 목록이며, 해당 마일스톤 작업 시작 전에 먼저 처리한다.

- [x] **문서 동기화(우선)**: `docs/02-relay-api.md` 6장, `docs/03-upstream-apis.md` 1.2·4.1·4.4장, `CLAUDE.md`의 "181건"/"1분 확장 1,440건" 서술을 5분 간격(현재 37건, 예측 실측 37 + 예보 288 = 325건)으로 갱신. `packages/shared` 타입에 top-level `model_version`, 프레임별 `outdoor`·`summary`·`quality` 필드 추가(05-open-questions #2, #5, #26).
- [x] **M4(현재 모드)**: `SensorHistoryClient`를 181 슬롯(1분)이 아닌 37 슬롯(5분 간격)으로 변경. 실제 센서 서버 API는 1분 간격만 제공(확인 완료, 05-open-questions #26) — 센서 서버에 5분 간격 이력 조회를 먼저 시도하고, 지원하지 않으면 1분 이력을 조회해 5분 마크(00·05·…·55분)만 선택(평균·보간 금지)해 연산 서버에는 5분 간격으로 넘긴다.
- [x] **M5(예측 모드)**: 예보 5분 간격 288건(실측 37+예보 288=325건) 구현 완료. `fan_pct` 클램프 계산식·`forecast_from`/`forecast_issued_at` 포함. summary 형식 폐기, `FORECAST_INPUT_FORMAT` 분기 제거 완료.
- [ ] **COMPUTE_BASE_URL**: 포트 9000은 `.env`/`.env.example`에 반영됨. `GET /v1/health` 핑 체크를 `GET /api/health`의 compute 상태에 반영하는 건 **아직 안 됨** — `apps/relay/src/routes/health.ts`가 여전히 `compute: 'disconnected'` 고정값(주석도 "M4/M8에서 붙는다"로 구식). 남은 작업.
- [x] **geometry 반영**: 온도 측 2026-10-08 v2 제공 `geometry.json`(room 칸막이·급기구 3개·배기구·센서 8개 위치 포함, 125개 포인트 실측 좌표)을 `config/geometry.json`에 반영 완료(2026-10-09). `scene/layout.ts`의 임시값은 메인 화면이 실측 glb 모델(`weaner_room_test-001.glb`)로 교체되면서 더 이상 렌더링에 쓰이지 않아 치수만 참고용으로 남겨둠(육성·비육 치수는 여전히 미확정, 05-open-questions #18).
- [x] **농장 위경도**: `.env`에 `FARM_LAT=33.446297`·`FARM_LON=126.563879`·`KMA_NX=53`·`KMA_NY=37` 반영 완료, 온도 측 값과 일치.
- [x] **M6(전문가 모드)**: 온도 측 2026-10-08 v2 제공 `mock/mock_expert.json`을 relay가 읽어 변환해 반환하도록 구현 완료. 입력값은 그대로 echo, 결과(frames)는 입력과 무관하게 동일(확인된 설계대로).
- [x] **M6(제어 모드)**: 온도 측 2026-10-08 v2 제공 `mock/mock_control.json`(`target:"energy"` 시나리오 하나)을 relay가 읽어 변환해 반환. `target=environment` 요청도 같은 파일을 쓰고 응답 `target` 필드만 요청값으로 덮어씀(05-open-questions #27, 파일 하나로 충분하다는 확정과 일치). `control` 블록(절감률·곡선) C안 화면까지 구현 완료.
- [ ] **WIND/날씨 변환**: `WIND` 0~360 숫자 → 16방위 변환은 구현됨(`windDirection.ts`). 미세기후 weatherCode의 "RAIN > 0이면 시간 무관 RAIN" 규칙도 구현됨(`weatherCode.ts`). **다만 풍속 `CURWIND`/`MAXWIND` 별도 필드는 아직 `StationWeather` 타입·3-2 화면에 반영 안 됨**(`mainWeatherStation.ts`가 `WIND`만 읽음, 풍속 표시 없음) — 남은 작업.
- [x] **EXPERT_INPUT_RANGE**: `EXPERT_TEMP_MIN/MAX`(−30~50)·`EXPERT_RH_MIN/MAX`(0~100)·`EXPERT_VENT_MIN/MAX`(20~100)로 `.env`/`env.ts`/대시보드 상수에 반영 완료.

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

## M7. 오류 처리·성능·이관 패키징

- 모든 영역의 끊김 표시 점검(센서·기상청·연산 서버 각각 차단 테스트).
- `npm start` 운영 모드: relay가 dashboard 정적 파일 서빙, 단일 포트.
- Windows 실행 스크립트 `start.bat`(빌드 결과 실행), 설치·실행·설정 방법을 적은 `README.md`(온도 측 비개발자가 따라 할 수 있는 수준: Node 설치, `.env` 작성, 실행, 접속 주소).
- 다른 PC로 폴더 복사 후 `.env`만 고쳐 실행되는지 확인.

완료 조건: 새 Windows PC에서 README만 보고 실행된다.

## M8. 연산 서버 실제 연동 (형식 확정 후)

- `HttpComputeClient` 구현, `COMPUTE_MODE=http` 전환, 타임아웃 값 확정.
- 온도에서 받은 125개 포인트 좌표를 `geometry.json`에 반영.
