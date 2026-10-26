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

// 스케일 바가 화면에서 겨냥하는 목표 픽셀 길이 — 개발자 결정.
export const SCALE_BAR_TARGET_PX = 120;

// 1920x1080(16:9) 설계 기준이지만 실제로는 창 크기에 맞춰 유동적으로 채운다(App.tsx,
// 2026-10-09). 이 두 값 아래로 작은 창에서만 스크롤 없이 잘리는 걸 허용하는 최소 크기
// (너비는 2026-10-10 사용자 확정 1280 — 상세 패널 788px 고정폭이 있어서 960이면 외부환경
// 쪽 공간이 너무 좁아짐. 높이는 기존 540 유지, 개발자 결정).
export const MIN_VIEWPORT_WIDTH_PX = 1280;
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

// 온도·습도 등치면(marching cubes) 단계 수·투명도 — 05-open-questions.md #17은 아직
// 미해결(온도 측 2026-10-07 답변에 언급 없음)이라 개발 중 임시값. 0.35는 예측 모드처럼
// 값 분포가 넓게 퍼지는 프레임에서 방 벽·바닥의 밝은 색과 거의 구분이 안 될 만큼 옅었다
// (2026-10-10 사용자 확인: "온습도 메쉬 ... 예측모드만 안보여"). 전문가·제어 모드는 같은
// 컴포넌트·같은 상수를 쓰지만 입력값이 선풍기 주변에 좁게 뭉쳐 대비가 커 보였을 뿐이라,
// 세 모드 모두에 적용되는 이 상수 자체를 올려 전반적으로 더 또렷하게 보이게 한다.
//
// 2026-10-14 재발("예측모드에 온도 습도 메쉬 안나오는데") — 투명도가 아니라 **등치면 단계를
// 어느 범위에서 뽑는지**가 진짜 원인이었다. 응답 전체 range(예측은 24시간 외기 변화 폭)로
// 4단계를 잡으면 한 프레임 값 폭(2~3 ℃)에 한 단계만, 그것도 끝값 근처에 걸려 표면이 거의 안
// 생긴다. 단계는 프레임 자체 min~max에서 뽑도록 고쳤다(detail/isosurfaceField.ts
// fieldValueRange, 05-open-questions.md #47) — 그래서 이 상수(4단계·0.75)는 그대로 둔다.
export const ISOSURFACE_LEVEL_COUNT = 4;
export const ISOSURFACE_OPACITY = 0.75;

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
// 반지름은 명세에 없음(개발자 결정) — 2026-10-10 사용자 요청: 288개가 한꺼번에 보이니
// 너무 두껍고 산만해 보여서 기존 0.025에서 절반으로.
export const FLOW_CYLINDER_RADIUS_M = 0.0125;
export const FLOW_CYLINDER_MIN_LENGTH_M = 0.12;
export const FLOW_CYLINDER_MAX_LENGTH_M = 0.42;

// 화살촉(원뿔) 크기 — 몸통 길이와 무관하게 고정이다. 길이에 비례해 키우면 값이 큰 화살표의
// 머리만 과장돼 보여서, 방향만 알아볼 수 있게 일정 크기로 둔다(2026-10-13 A-3 "방향은
// (vx,vy,vz), 길이와 색은 value"). 반지름은 몸통의 3배, 길이는 최소 몸통 길이의 절반.
export const FLOW_ARROW_HEAD_RADIUS_M = FLOW_CYLINDER_RADIUS_M * 3;
export const FLOW_ARROW_HEAD_LENGTH_M = FLOW_CYLINDER_MIN_LENGTH_M / 2;

// 전문가 모드 입력 필드(21) 유효 범위 — apps/relay/src/config/env.ts의 EXPERT_TEMP_MIN 등
// 기본값과 반드시 같은 값을 유지한다(detail/expertInputValidation.ts가 이 값으로 검사해
// 통과한 값만 POST /api/detail/expert로 보내므로, 중계 서버 400과 어긋나면 안 된다).
// 입력값 범위·단위는 온도 제공 예정(01-functional-spec.md 4.3) — 받기 전까지 relay 기본값.
export const EXPERT_TEMP_MIN = -30;
export const EXPERT_TEMP_MAX = 50;
export const EXPERT_RH_MIN = 0;
export const EXPERT_RH_MAX = 100;
export const EXPERT_VENT_MIN = 20;
export const EXPERT_VENT_MAX = 100;

// 전문가 모드 입력 표 행 수 = 1시간 간격 24시간(B-2). apps/relay의 EXPERT_INPUT_ROW_COUNT와 같은 값.
export const EXPERT_INPUT_ROW_COUNT = 24;

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

// 유동 입자 애니메이션(scene/FlowParticles.tsx, 2026-10-26 온도 측 요청) — 명세 없음(개발자
// 결정), 화면 보고 조정한다. 개수·꼬리는 참고 샘플(입자 6,000·꼬리 12)보다 줄였다 — 방이
// 비슷한 크기라도 유동 격자가 288점이라 입자를 늘려도 흐름이 더 자세해지지 않는다.
export const FLOW_PARTICLE_COUNT = 2500;
export const FLOW_PARTICLE_TRAIL = 10;
/** 다시 태어날 때 급기구에서 나올 비율 — 나머지는 방 안 아무 곳(방 전체 흐름도 보이게). */
export const FLOW_PARTICLE_INLET_SHARE = 0.5;
export const FLOW_PARTICLE_LIFE_MIN_S = 4;
export const FLOW_PARTICLE_LIFE_MAX_S = 10;
/** 화면 1초 = 실제 몇 초 — 유속이 평균 0.1 m/s 안팎이라 실제 속도로는 거의 멈춰 보인다. */
export const FLOW_PARTICLE_TIME_SCALE = 6;
export const FLOW_PARTICLE_STUCK_SPEED = 0.01;
export const FLOW_PARTICLE_STUCK_S = 1.5;
export const FLOW_PARTICLE_SIZE_M = 0.05;
