// 화면 전역 상수. 미확정/개발자 결정 값은 docs/05-open-questions.md를 참고하고,
// 여기서는 그 상수만 모아둔다(CLAUDE.md "치수는 설정 상수로 분리").
import type { Vector3Tuple } from 'three';

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
export const OVERVIEW_CAMERA_MARGIN_FACTOR = 1.6;

// 메인 화면(4) 3D 카메라 각도(center에서 떠는 축별 비율 [x,y,z]) — 상세 패널 3D 뷰
// (scene/cameraFraming.ts DEFAULT_CAMERA_DIRECTION, 포팅 원본값)와 분리된 메인 화면 전용 값
// (2026-10-10 사용자가 메인 화면만 직접 조정 — 수작업으로 바꿀 때는 이 배열만 수정할 것).
export const OVERVIEW_CAMERA_DIRECTION: Vector3Tuple = [0.2, 0.18, 0.24];

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

// 메인 3D 모델링 배경 레이어(App.tsx) 고정 크기 — 패널들(헤더·외부환경·상세패널)은 창 크기에
// 맞춰 반응형으로 늘어나지만, 3D 캔버스만은 창 리사이즈에 반응하지 않고 이 크기로 고정한다
// (2026-10-10 사용자 확정 — 리사이즈마다 카메라 비율을 다시 계산하면 setViewOffset 각도 계산이
// 복잡해지고 자칫 찌그러질 수 있어서, 아예 안 바뀌게 고정하는 쪽을 선택함). 창이 이보다 작으면
// 바깥쪽 overflow-hidden에 의해 잘리고, 크면 캔버스 바깥은 그냥 페이지 배경색으로 남는다.
export const MAIN_SCENE_WIDTH_PX = 1920;
export const MAIN_SCENE_HEIGHT_PX = 1080;

// 상세보기 패널(6) 고정 폭 — App.tsx 레이아웃과 scene/CameraRig.tsx(메인 3D 캔버스가 전체
// 화면 폭이라, 상세 패널에 가려지지 않는 "보이는 영역"의 중앙을 계산할 때)가 공유한다.
// 둘 중 하나만 바꾸면 어긋나므로 반드시 같이 바꿀 것.
export const DETAIL_PANEL_WIDTH_PX = 788;

// 상세 패널(6) 2D 수평단면 높이(m) — relay .env의 SECTION_Z_M(기본 0.5, docs/02-relay-api.md
// 5장)과 같은 값을 유지해야 한다. 대시보드는 .env를 읽지 않으므로 상수로 따로 두고, 값을
// 바꿀 때는 relay .env와 이 값을 함께 수정한다(05-open-questions.md #16: 0.5 확정).
export const SECTION_Z_M = 0.5;

// 2D 수평단면에 겹쳐 그리는 Y자 칸막이(m, room 좌표 x·y) — 고정 구조물이라 relay 응답으로
// 받지 않고 상수로 둔다(01-functional-spec.md 3장, 2026-10-09 사용자 확정). 값은
// config/geometry.json room.partition.segments와 동일(높이 0.78m라 단면 0.4m층을 지난다).
export const SECTION_PARTITION_SEGMENTS: ReadonlyArray<
  readonly [readonly [number, number], readonly [number, number]]
> = [
  [
    [1.82, 0.0],
    [1.82, 3.25],
  ],
  [
    [1.82, 3.25],
    [1.42, 4.0],
  ],
  [
    [1.82, 3.25],
    [2.22, 4.0],
  ],
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

// 이 파일을 수정할 때마다 Vite가 "부분 갱신"(HMR)을 시도하는데, 여기 값들은 scene/CameraRig.tsx
// 등의 useEffect 의존성 목록에 없는 평범한 상수라 부분 갱신으로는 효과가 재실행되지 않고
// 어중간한 상태(예: 메인 3D 모델링이 찌그러져 보임)가 될 수 있다(2026-10-10). 이 파일을
// 직접 accept한 뒤 바로 invalidate하면, Vite가 부분 갱신을 포기하고 페이지를 통째로
// 새로고침해서 깨끗한 상태로 다시 뜬다 — 개발 모드에서만 동작하고(import.meta.hot은 운영
// 빌드에선 undefined) 배포에는 영향 없다.
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate();
  });
}
