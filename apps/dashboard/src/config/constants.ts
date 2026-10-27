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
export const CAMERA_MARGIN_FACTOR = 1.6;

// 메인 화면(4) 3D 카메라 초기 프레이밍 여유(배율) — technical-review/pig-farm-cfd-demo의
// overviewScene.js OVERVIEW_MARGIN_FACTOR 1.6을 그대로 포팅했다가, 2026-10-26 레이아웃 (1)로
// 2.05로 올렸다. 모델을 왼쪽으로 밀면(OVERVIEW_VIEW_SHIFT_PX) 회전 중심이 자돈방에 고정돼
// 있어서 축사 꼬리(비육돈방)가 상세 패널 가장자리로 밀려 잘린다 — 같이 축소해야 전체가 들어온다.
// 이 둘은 짝이다: shift를 바꾸면 이 값도 다시 맞춰야 한다(shift 0·1.6 / 300·1.85는 꼬리가 잘렸고,
// 500·2.05에서 축사 전체가 x 75~990에 들어왔다 — 1920×1080 크롬 실측).
export const OVERVIEW_CAMERA_MARGIN_FACTOR = 2.05;

// 메인 화면(4) 3D 카메라 각도(center에서 떠는 축별 비율 [x,y,z]) — 상세 패널 3D 뷰
// (scene/cameraFraming.ts DEFAULT_CAMERA_DIRECTION, 포팅 원본값)와 분리된 메인 화면 전용 값
// (2026-10-10 사용자가 메인 화면만 직접 조정 — 수작업으로 바꿀 때는 이 배열만 수정할 것).
export const OVERVIEW_CAMERA_DIRECTION: Vector3Tuple = [0.14, 0.1, 0.21];

// 상세 패널(6) 3D 카메라 각도 — 메인 화면과 "처음 보이는 방향"을 맞추기 위한 전용 값
// (2026-10-26 온도 추가요청 레이아웃 (6): "두 화면에서 자돈사 방의 좌·우 방향이 서로 다르게
// 보입니다"). 전에는 cameraFraming.ts의 DEFAULT_CAMERA_DIRECTION(목업 포팅 원본값)을 그대로
// 썼는데, 그 값과 메인 값은 방위각이 거의 같은데도(40° vs 43°) 두 화면의 방 좌표계가 달라
// 좌·우가 반대로 읽혔다. 메인을 기준으로 삼고(메인에서 방을 클릭해 들어오는 흐름이라 클릭한
// 모습 그대로 커지는 게 맞다) 이 값만 돌려 맞춘다. 사용자가 드래그로 돌리는 건 그대로다.
//
// 값은 포팅 원본값 [0.433, 0.379, 0.462]를 Y축 기준 방위각으로 **+90° 돌린 것**이다(고도각
// 31°는 그대로). 네 방위를 전부 찍어 메인과 대조해 골랐다 — 메인에서는 급기구 3개가 왼→오로
// 내려가고 배기팬이 왼쪽 벽, Y자 칸막이가 오른쪽 아래로 뻗는데, 이 값만 셋을 모두 만족한다
// (180°는 급기구가 거꾸로 올라가고, −90°는 배기팬이 오른쪽에 붙어 거울상이 된다).
export const DETAIL_CAMERA_DIRECTION: Vector3Tuple = [0.462, 0.12, -0.45];

// 메인 화면(4) 3D 모델을 보이는 영역 중앙에서 더 **왼쪽으로** 밀어내는 양(px) — CameraRig의
// setViewOffset에 상세 패널 폭과 함께 더해진다. 0이면 "상세 패널에 안 가려지는 영역의 정중앙"
// 그대로다(2026-10-10 구현).
// 2026-10-26 온도 추가요청 레이아웃 (1): "전체 축사 3D 모델링 중심을 왼쪽으로 — 오른쪽
// 결과창이 열리면 자돈방이 가려짐". 상세 패널이 항상 열려 있는 화면이라 이미 패널 폭만큼은
// 비켜 두지만, 축사가 가로로 길어 오른쪽 끝(비육돈방)이 패널 가장자리에 닿는다.
// 이 값을 Δ만큼 올리면 모델이 Δ/2 px 왼쪽으로 간다 — 광학 중심이 (w − p)/2 이므로.
// 곁들여 시야각이 조금 넓어져 모델이 미세하게 작아진다(aspect = (w + p) / h).
export const OVERVIEW_VIEW_SHIFT_PX = 180;

// 메인 화면(4) 3D 모델을 화면에서 **위로** 올리는 양(px) — 가로(OVERVIEW_VIEW_SHIFT_PX)와 같은
// setViewOffset 요령을 세로에 쓴다. 캔버스보다 이 값만큼 높은 가상 프레임의 "아래쪽" 구간을
// 찍는 척하면, 가상 프레임의 광학 중심 (h + q) / 2 가 실제 캔버스에서는 (h − q) / 2 지점에
// 오므로 모델이 q / 2 px 위로 간다. 0이면 캔버스 세로 정중앙 그대로다.
// 양수 = 위로, 음수 = 아래로. 2026-10-26 사용자 요청("메인 모델링이 전체적으로 올라가 보이게").
// aspect는 fullWidth / fullHeight로 둬야 찌그러지지 않는다(CameraRig.tsx 주석 참고).
export const OVERVIEW_VIEW_SHIFT_Y_PX = 0;

// 상세 패널(6) 3D 조명 세기 배율 — 리그 5개(Hemisphere 0.55 / Ambient 0.18 / Directional 1.1 /
// Fill 0.12 / Point 0.8, components/detail/Detail3DView.tsx)에 한꺼번에 곱한다. 1이 포팅 원본값.
// 2026-10-26 사용자: "상세보기 방에 조명이 너무 밝아서 흐름이 잘 안 보일 수 있어" — 유동 입자가
// 밝은 벽·바닥에 묻히는 문제라 한 손잡이로 조절할 수 있게 뺐다. 0이면 조명과 환경맵 반사광을
// 모두 끈다(환경맵만 남겨두면 PBR 재질이 그것만으로도 꽤 밝다).
// 찍어 보고 고른 값: 1(원본)은 입자가 밝은 벽에 묻히고, 0은 방이 완전히 검어져 벽·돼지·
// 칸막이가 사라진다. 0.15는 방 윤곽이 남으면서 입자 줄기가 또렷하다.
// 타입을 number로 못박는다 — 리터럴 타입(0.15)으로 좁혀지면 Detail3DView의 `=== 0` 분기가
// "겹치지 않는 비교"로 타입 오류가 난다. 조절용 손잡이라 값만 바꿔 쓰는 상수다.
export const DETAIL_LIGHT_SCALE: number = 0.15;

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

// 메인 3D 배경 레이어를 화면에서 위로 끌어올리는 양(px, 음수가 위로) — App.tsx의 main-scene
// 레이어 style.top. 2026-10-26 사용자 요청("메인 모델링이 전체적으로 올라가 보이게").
// OVERVIEW_VIEW_SHIFT_Y_PX(카메라 투영을 트는 방식)와 달리 **순수한 평행 이동**이라 확대·
// 찌그러짐이 없고 margin·shift 값과 물리지 않는다. 대신 모델 위쪽이 창 밖으로 잘리고,
// 화면 맨 아래 이 값만큼은 캔버스 바깥이 되어 그 띠에서는 3D 드래그가 먹지 않는다
// (그 자리엔 좌측 하단 기상 묶음·우측 하단 축척이 있어 실사용에 지장 없음).
export const MAIN_SCENE_TOP_PX = -20;

// 좌측 하단 오버레이 묶음(위치 이름 + 외부환경(3)) 축소 비율 — App.tsx.
// 2026-10-26 온도 추가요청 레이아웃 (2): 3D 모델링을 더 크게 보이게 하려고 외부환경 패널을
// 왼쪽 위에서 왼쪽 아래로 내리고 80%로 줄였다(헤더에 있던 위치 이름도 같이 내려 한 덩어리).
// 축소는 OutdoorPanel 내부 치수(Figma 실측값)를 건드리지 않도록 바깥 래퍼의 CSS transform으로
// 한다 — 치수를 하나씩 0.8배 하면 반올림으로 시안이 깨진다. transform은 레이아웃 박스를
// 바꾸지 않지만, 이 묶음은 좌측 하단 모서리에 홀로 붙어 있어(축척은 우측 하단으로 옮겼다)
// 다른 요소와의 간격 계산이 필요 없다.
export const OUTDOOR_CLUSTER_SCALE = 0.8;

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
/** 칸막이 높이(m) — config/geometry.json room.partition.height. 유동 입자가 이 아래에서는 칸막이를 못 지난다. */
export const PARTITION_HEIGHT_M = 0.78;

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
export const ISOSURFACE_OPACITY = 0.45;

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

// 유동 입자 애니메이션(scene/FlowParticles.tsx). 규칙은 온도 데이터와 자돈방 안내문 기준이다
// (mock/응답형식_추가안내_v1.3.3.txt "화면 구현 참고" — 급기구에서 출발, 배기구에서 소멸, 출발 개수는
// 급기 풍량 비례, 1·3·10배). 샘플 HTML은 참고만 한다(2026-10-27 사용자). 세부는 detail/flowParticles.ts.
/** 동시에 떠 있는 최대 입자 수(개발자 결정). 급기 공기 1 m³당 입자 수 = 이 값 ÷ 방 체적. */
export const FLOW_PARTICLE_COUNT = 2500;
export const FLOW_PARTICLE_TRAIL = 28;
export const FLOW_PARTICLE_SIZE_M = 0.05;
/**
 * 머리(원)의 화면 크기 한계(px). 월드 크기(FLOW_PARTICLE_SIZE_M)만 쓰면 확대할수록 원이
 * 무한정 커져 1px 꼬리선과의 비율이 벌어진다(2026-10-27 사용자: "원과 라인에 비율이 크지 않아").
 * 온도 측 샘플 뷰어도 같은 방식이다 — gl_PointSize를 clamp(uSize*uScale/-z, 1.5, 7)로 자른다.
 */
export const FLOW_PARTICLE_MIN_PX = 1.5;
export const FLOW_PARTICLE_MAX_PX = 7;
/** 배속 선택지 — 안내문의 1·3·10배. 화면 1초 = 실제 몇 초. */
export const FLOW_PARTICLE_SPEEDS = [1, 3, 10] as const;
export type FlowParticleSpeed = (typeof FLOW_PARTICLE_SPEEDS)[number];
/**
 * 기본 배속 10배 — grid.flow 방 안 유속이 평균 0.02 m/s(95 %가 0.05 이하)라 1·3배로는 거의 멈춰
 * 보이고, 빈 방에서 시작해 급기구 입자로 차는 데 3배는 1분 넘게 걸린다(10배는 약 30초).
 */
export const FLOW_PARTICLE_DEFAULT_SPEED: FlowParticleSpeed = 10;
/**
 * supply가 없을 때(viz 꺼짐·구버전 서버) 쓰는 급기 풍량(m³/h) — 온도 측 2026-10-27:
 * 환기팬 가동률에 따라 보통 약 770~1,240 m³/h, 그 최댓값.
 */
export const FLOW_PARTICLE_FALLBACK_AIRFLOW_M3H = 1240;
