// 화면 전역 상수. 미확정/개발자 결정 값은 docs/05-open-questions.md를 참고하고,
// 여기서는 그 상수만 모아둔다(CLAUDE.md "치수는 설정 상수로 분리").

// 메인 화면 데이터 갱신 주기 — 접속 시 1회 + 10분마다(01-functional-spec.md 2장).
export const MAIN_POLL_INTERVAL_MS = 10 * 60 * 1000;

// 상세 패널(6) "현재" 탭 데이터 갱신 주기 — 접속 시 1회 + 유지 중 10분마다(docs/02-relay-api.md
// 6장, docs/04-tasks.md M4 완료 조건). relay가 같은 10분 구간 재요청은 캐시로 응답하므로
// 대시보드는 그냥 10분마다 다시 부르면 된다.
export const CURRENT_DETAIL_POLL_INTERVAL_MS = 10 * 60 * 1000;

// 상단 날짜·요일·시간 갱신 주기(01-functional-spec.md 2장 #2).
export const CLOCK_TICK_INTERVAL_MS = 1000;

// 상세 패널(6) 3D 카메라 초기 프레이밍 여유(배율) — 개발자 결정.
export const CAMERA_MARGIN_FACTOR = 1.5;

// 메인 화면(4) 3D 카메라 초기 프레이밍 여유(배율) — technical-review/pig-farm-cfd-demo의
// overviewScene.js OVERVIEW_MARGIN_FACTOR 그대로 포팅(docs/07-starter-kit-assets.md).
export const OVERVIEW_CAMERA_MARGIN_FACTOR = 1.4;

// 방 호버 정보 판넬(5-1~5-3) 콜아웃 앵커 — 방 바운딩박스 중심에서 위로 띄우는 높이(m).
// overviewScene.js의 labelAnchors(center.y + size.y/2 + 0.4)와 동일.
export const ROOM_CALLOUT_OFFSET_M = 0.4;

// 스케일 바가 화면에서 겨냥하는 목표 픽셀 길이 — 개발자 결정.
export const SCALE_BAR_TARGET_PX = 120;

// 1920x1080(16:9) 설계 기준이지만 실제로는 창 크기에 맞춰 유동적으로 채운다(App.tsx,
// 2026-10-09). 이 두 값 아래로 작은 창에서만 스크롤 없이 잘리는 걸 허용하는 최소 크기
// (설계 기준의 절반, 개발자 결정).
export const MIN_VIEWPORT_WIDTH_PX = 960;
export const MIN_VIEWPORT_HEIGHT_PX = 540;

// 상세 패널(6) 2D 수평단면 높이(m) — relay .env의 SECTION_Z_M(기본 0.5, docs/02-relay-api.md
// 5장)과 같은 값을 유지해야 한다. 대시보드는 .env를 읽지 않으므로 상수로 따로 두고, 값을
// 바꿀 때는 relay .env와 이 값을 함께 수정한다(05-open-questions.md #16: 0.5 확정).
export const SECTION_Z_M = 0.5;

// 2D 수평단면에 겹쳐 그리는 Y자 칸막이(m, room 좌표 x·y) — 고정 구조물이라 relay 응답으로
// 받지 않고 상수로 둔다(01-functional-spec.md 3장, 2026-10-09 사용자 확정). 값은
// config/geometry.json room.partition.segments와 동일(높이 0.78m라 단면 0.4m층을 지난다).
export const SECTION_PARTITION_SEGMENTS: ReadonlyArray<readonly [readonly [number, number], readonly [number, number]]> = [
  [[1.82, 0.0], [1.82, 3.25]],
  [[1.82, 3.25], [1.42, 4.0]],
  [[1.82, 3.25], [2.22, 4.0]],
];

// 현재 모드(9~13)에서도 2D 단면을 보여줄지 — 01-functional-spec.md 3장은 "현재 모드에
// 2D가 필요한지 확인 중"이라 플래그로 숨길 수 있게 하라고 돼 있지만, 이미
// 05-open-questions.md #15(2026-10-07 확정: "필요함", 현재 모드 응답에도 grid 포함)로
// 해소된 사항이라 기본 true로 둔다. 플래그 자체는 명세 문구 대비용으로 남겨둔다.
export const SHOW_2D_IN_CURRENT = true;

// 예측·전문가·제어 모드 타임라인(17·24·31) 재생 속도 — 기본값 "프레임당 0.5초"
// (01-functional-spec.md 4.5, 05-open-questions.md #20 "개발자 결정: 상수 분리").
export const TIMELINE_FRAME_DURATION_MS = 500;

// 온도·습도 등치면(marching cubes) 단계 수·투명도 — 05-open-questions.md #17에서
// "4단계, 0.35"로 확정(온도 측 2026-10-07 답변 기준, opacity는 0~1).
export const ISOSURFACE_LEVEL_COUNT = 4;
export const ISOSURFACE_OPACITY = 0.35;

// three-stdlib MarchingCubes(node_modules/three-stdlib/objects/MarchingCubes.js)는 정육면체
// 해상도(size=size2=size3)만 지원한다 — 비정육면체 grid(19×17×8 등)는
// scene/coords.ts의 zUpVolumeGroupTransform으로 각 축 스케일을 다시 맞춘다. 해상도는
// 보통 "2배 업샘플된 grid의 가장 큰 축 크기"로 정하되(detail/isosurfaceField.ts
// isosurfaceCubeResolution), 더 큰 grid가 들어와도 비용이 과도해지지 않게 상한을 둔다.
export const ISOSURFACE_MAX_RESOLUTION = 48;

// MarchingCubes 생성자의 maxPolyCount(기본 1e4) — 해상도가 높아 넉넉히 올려 잡는다.
export const ISOSURFACE_MAX_POLY_COUNT = 30000;

// flowGrid 실린더(scene/FlowCylinders.tsx) 반지름·길이 — flowGrid 칸 크기(수평 0.5 m·
// 높이 0.7 m, docs/02-relay-api.md 5장)보다 작게 둬서 인접 노드와 겹치지 않게 한다.
export const FLOW_CYLINDER_RADIUS_M = 0.025;
export const FLOW_CYLINDER_MIN_LENGTH_M = 0.12;
export const FLOW_CYLINDER_MAX_LENGTH_M = 0.42;

// 전문가 모드 입력 필드(21) 유효 범위 — apps/relay/src/config/env.ts의 EXPERT_TEMP_MIN 등
// 기본값과 반드시 같은 값을 유지한다(detail/expertInputValidation.ts가 이 값으로 검사해
// 통과한 값만 GET /api/detail/expert로 보내므로, 중계 서버 400과 어긋나면 안 된다).
// 입력값 범위·단위는 온도 제공 예정(01-functional-spec.md 4.3) — 받기 전까지 relay 기본값.
export const EXPERT_TEMP_MIN = -30;
export const EXPERT_TEMP_MAX = 50;
export const EXPERT_RH_MIN = 0;
export const EXPERT_RH_MAX = 100;
export const EXPERT_VENT_MIN = 20;
export const EXPERT_VENT_MAX = 100;

// 제어 모드(27~34) 환기량 비교 그래프(C안) — x축 24시간을 6시간 간격 눈금으로 표시
// (01-functional-spec.md 4.4). y축은 팬 가동률 % 고정 범위.
export const CONTROL_CHART_Y_MAX = 100;
export const CONTROL_CHART_TICK_STEP_MIN = 6 * 60;
