# 04. 작업 단계

계약 기간 1개월차(돈사 대시보드) 기준. 단계마다 완료 조건을 확인하고 요약 보고 후 다음 단계로 넘어간다. 공통 완료 조건: `npm run typecheck && npm test && npm run lint` 통과.

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
