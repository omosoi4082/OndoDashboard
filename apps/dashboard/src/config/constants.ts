import type { OutletHit } from '../detail/flowParticles.js';
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

/**
 * 상세 패널(6) 3D 카메라 초기 프레이밍 여유(배율) — 클수록 멀리서 본다(모델이 작아진다).
 *
 * **가로 기준**이다(2026-10-28 사용자: "현재 모드와 제어 모드 3D 모델링 축소되는 갭이 크네",
 * "높이에 따른 확대 축소 필요없을 것 같은데"). Detail3DView가 이 값을 캔버스 가로세로비로 나눠
 * 거리를 정한다 — Three.js 원근 카메라의 화각(fov 45°)은 **세로** 기준이라, 그냥 두면 3D 박스가
 * 낮은 모드일수록 모델이 작게 그려졌다. 박스 세로는 모드마다 다르고 가로는 778로 같다:
 *   현재 798×844 / 예측 798×777 / 제어 798×728 (1920×1080 크롬 실측) → 제어가 현재보다 14 % 작았다.
 *
 * 값 이력: 포팅 원본 1.6 → 2.2(2026-10-28 사용자 "가까이에서 시작해서 단면 판이 안 보이는데 조금
 * 밀어줘"). 2.6은 카메라가 천장 위로 올라가 위쪽이 텅 빈 띠로 보여서 뺐다(세로 기준이던 시절).
 * 가로 기준으로 바꾸면서 2.03(= 2.2 × 0.922, 세로 기준 2.2와 같은 크기)을 거쳤다가,
 * 2026-10-28 사용자 요청으로 **숫자 그대로 2.2**로 뒀다 — 세로 기준 2.2보다 8 % 작게 보인다.
 */
export const CAMERA_MARGIN_FACTOR = 2.5;

/**
 * 상세 패널(6) 3D 프레이밍 기준 캔버스 비율 — **현재 모드 3D 박스(798 × 844)**.
 * 기준 세로 화각(DETAIL_CAMERA_FOV_DEG)과 CAMERA_MARGIN_FACTOR가 모두 이 비율에서의 값이다.
 * 3D 박스 가로는 네 모드가 같고(778) 세로만 다르므로(현재 844 / 예측 777 / 제어 728),
 * 이 기준 하나로 네 모드를 똑같이 맞춘다 — Detail3DView 주석 참고.
 */
export const DETAIL_FRAME_REF_ASPECT = 798 / 844;

/**
 * 상세 패널(6) 3D 카메라 세로 화각(°) — DETAIL_FRAME_REF_ASPECT 비율에서의 값이다.
 * 실제 화각은 Detail3DView가 캔버스 비율에 맞춰 매번 다시 계산한다(가로 화각을 고정하려고).
 */
export const DETAIL_CAMERA_FOV_DEG = 45;

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

/**
 * 상세 패널(6) 3D 모델을 화면에서 **위로 올리는 양(m)** — 2026-10-28 사용자 "상세 모델링을
 * 전체적으로 조금 위로 올리고 싶은데". 양수면 위로, 음수면 아래로. 0이면 처음 프레이밍 그대로.
 *
 * 방식은 **카메라 평행 이동(pan)**이다 — 카메라 위치와 OrbitControls target을 둘 다 같은 양만큼
 * 아래로 내린다. 그러면 방 중심이 화면 중앙보다 그만큼 위에 찍힌다. 각도·거리·화각이 안 변해서
 * 확대나 찌그러짐이 없다.
 *
 * 다른 방법을 안 쓴 이유:
 *  - 메인 화면처럼 캔버스를 CSS로 밀어 올리기(MAIN_SCENE_TOP_PX): 상세 3D는 테두리 있는 박스
 *    안이라 위가 잘리고 아래에 빈 띠가 생긴다.
 *  - setViewOffset으로 투영을 트는 방법(OVERVIEW_VIEW_SHIFT_Y_PX): 세로 화각이 가상 프레임
 *    기준이 되어 모델이 같이 확대되고 aspect를 수동 관리해야 한다(그 상수도 결국 0으로 두고
 *    MAIN_SCENE_TOP_PX를 쓴다).
 *
 * 화면에서 몇 px 올라가는지는 카메라 거리와 화각에서 나온다 — 지금 값(방 4.5×4.0×2.8,
 * CAMERA_MARGIN_FACTOR 2.2, fov 45°, 캔버스 798×844)이면 **1 m ≈ 97 px**이다.
 * 사용자가 드래그로 옮기는 건 그대로다(이 값은 처음 프레이밍에만 쓴다).
 */
export const DETAIL_VIEW_LIFT_M = 0.4;

/**
 * 상세 패널(6) 3D 모델을 화면에서 **오른쪽으로 보내는 양(m)** — 2026-10-28 사용자 "상세 모델링을
 * 우측으로 당기고 싶은데". 양수면 오른쪽, 음수면 왼쪽. 0이면 처음 프레이밍 그대로.
 * DETAIL_VIEW_LIFT_M(위아래)과 같은 짝이고 방식도 같다 — 카메라와 OrbitControls target을
 * **화면 왼쪽 방향으로** 같이 옮기는 평행 이동이라 각도·거리·화각이 안 변한다.
 *
 * "화면 왼쪽"은 카메라가 보는 방향에서 구한다(시선 × 위쪽 = 화면 오른쪽 벡터). 늘 수평이라
 * 높이는 건드리지 않는다. 각도(DETAIL_CAMERA_DIRECTION)를 바꿔도 따라 돈다.
 *
 * 0.3 m ≈ 28 px(방 4.5×4.0×2.8, CAMERA_MARGIN_FACTOR 2.2, fov 45°, 캔버스 798×844 기준).
 * 그냥 두면 방이 왼쪽 끝에 닿고 오른쪽에 60 px이 남아서 그만큼 가운데로 보낸 값이다.
 *
 * 타입을 number로 못박는다 — 리터럴 타입(0.3)으로 좁혀지면 Detail3DView의 `!== 0` 분기가
 * "겹치지 않는 비교"로 타입 오류가 난다(DETAIL_LIGHT_SCALE와 같은 이유).
 */
export const DETAIL_VIEW_SHIFT_M: number = 0.15;

/**
 * 3D 위에 떠 있는 카드의 그림자 — 제어 모드 그래프 요약 카드(ControlSummaryCard) 시안
 * "그래프 백그라운드참고.png"(2026-10-11 전달) Figma Effects 패널 실측값이다.
 * 3겹 drop shadow(X0/Y6/blur12/48 %, X0/Y12/blur32/32 %, X0/Y18/blur56/20 %).
 *
 * 2026-10-28 사용자 "제어 모드 그래프에 그림자 같은 게 있던데 오버레이되는 범례·평면도에도
 * 적용해 줘" — 그래프 카드·포인트 호버 패널에만 있던 것을 상수로 빼서 색 범례와 2D 수평단면
 * 그림에도 같이 쓴다. 넷 다 3D 위에 떠 있는 카드라 같은 효과여야 한다.
 */
export const OVERLAY_CARD_SHADOW =
  '0 6px 12px rgba(0,0,0,0.48), 0 12px 32px rgba(0,0,0,0.32), 0 18px 56px rgba(0,0,0,0.2)';

// 메인 화면(4) 3D 모델을 보이는 영역 중앙에서 더 **왼쪽으로** 밀어내는 양(px) — CameraRig의
// setViewOffset에 상세 패널 폭과 함께 더해진다. 0이면 "상세 패널에 안 가려지는 영역의 정중앙"
// 그대로다(2026-10-10 구현).
// 2026-10-26 온도 추가요청 레이아웃 (1): "전체 축사 3D 모델링 중심을 왼쪽으로 — 오른쪽
// 결과창이 열리면 자돈방이 가려짐". 상세 패널이 항상 열려 있는 화면이라 이미 패널 폭만큼은
// 비켜 두지만, 축사가 가로로 길어 오른쪽 끝(비육돈방)이 패널 가장자리에 닿는다.
// 이 값을 Δ만큼 올리면 모델이 Δ/2 px 왼쪽으로 간다 — 광학 중심이 (w − p)/2 이므로.
// 곁들여 시야각이 조금 넓어져 모델이 미세하게 작아진다(aspect = (w + p) / h).
// 2026-10-28 사용자 "메인 모델 좌측으로 조금" — 180 → 280(왼쪽으로 50 px).
export const OVERVIEW_VIEW_SHIFT_PX = 280;

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
//
// 2026-10-28 사용자 지시로 788 → 820, 2026-10-29 **840**. 안쪽 3D·2D 내용은 고정 폭을 버리고
// 남는 폭을 전부 쓰므로(DetailSections.tsx `w-full`) 이 값만 바꾸면 3D 캔버스가 같이 넓어진다:
//   패널 840 − 오른쪽 여백 20(App.tsx pr-5) = 카드 820 − 카드 패딩 10+10 = **내용 800**.
export const DETAIL_PANEL_WIDTH_PX = 840;

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
/**
 * 유동 입자가 칸막이에 막히는지 — **온도 측 요구가 아니라 우리 판단으로 넣은 규칙**이다(2026-10-28).
 * 연산 서버가 주는 유속에는 칸막이가 들어 있지 않아, 데이터대로만 움직이면 입자가 3D 모델의
 * 칸막이를 그대로 통과한다. 실제로 벽이 있는데 통과하는 그림이 더 어색해서 막고, 벽에 부딪친
 * 만큼은 위로 올려 타고 넘게 했다(detail/flowParticles.ts의 blockedByPartition·partitionDeflect).
 * **온도 측이 "데이터 그대로 두라"고 하면 이 값을 false로 바꾸면 원래대로 통과한다.**
 */
export const PARTITION_BLOCKS_PARTICLES = true;

/** 칸막이 높이(m) — config/geometry.json room.partition.height. 유동 입자가 이 아래에서는 칸막이를 못 지난다. */
export const PARTITION_HEIGHT_M = 0.78;

// 현재 모드(9~13)에서도 2D 단면을 보여줄지 — 01-functional-spec.md 3장은 "현재 모드에
// 2D가 필요한지 확인 중"이라 플래그로 숨길 수 있게 하라고 돼 있지만, 이미
// 05-open-questions.md #15(2026-10-07 확정: "필요함", 현재 모드 응답에도 grid 포함)로
// 해소된 사항이라 기본 true로 둔다. 플래그 자체는 명세 문구 대비용으로 남겨둔다.
export const SHOW_2D_IN_CURRENT = true;

/**
 * 3D 안에 겹치는 2D 수평단면 그림의 단면 폭(px) — 높이는 방 비율(4.5 × 4.0 m)대로 정해진다.
 * 2026-10-28 사용자 결정: 2D 칸을 없애고 3D 오른쪽 범례(56 × 180) 바로 아래에 둔다. 개발자 결정
 * 값이라 화면을 보고 바꾸면 된다.
 */
export const SECTION_INSET_WIDTH_PX = 150;

/**
 * 단면 높이 슬라이더(2026-10-28 사용자: 온도 측 샘플 뷰어처럼 슬라이더로 단면 높이를 옮긴다) —
 * 범위·간격(m). 바닥(0)·천장(2.8)에 딱 붙으면 3D 판이 바닥·천장과 겹쳐 깜박이므로 0.1 m 안쪽까지.
 * 층 사이 높이는 위아래 grid 층을 섞은 값이다(sectionGrid.ts interpolateZLayer). 개발자 결정 값.
 */
export const SECTION_Z_MIN_M = 0.1;
export const SECTION_Z_MAX_M = 2.7;
export const SECTION_Z_STEP_M = 0.1;

/**
 * 3D 단면 높이 표시 판 — 방 **바깥에만** 두르는 반투명 테(2026-10-28 사용자: "모델링 안으로는 안 보이고
 * 밖에만, 반투명"). 방 안 입자·돼지를 가리지 않고, 색은 오른쪽 단면 그림에만 칠한다.
 * 테 폭(m)·면 투명도·테두리 선 투명도는 개발자 결정 값.
 */
export const SECTION_PLANE_MARGIN_M = 0.35;
export const SECTION_PLANE_OPACITY = 0.22;
export const SECTION_PLANE_EDGE_OPACITY = 0.7;

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
/** 동시에 떠 있는 최대 입자 수(2026-10-27 사용자 지정 4,000). 급기 공기 1 m³당 입자 수 = 이 값 ÷ 방 체적.
 * 이 PC 실측으로는 9,000까지 60fps, 12,000부터 프레임이 빠졌다 — 테스트 PC 사양을 모르니 여유를 둔다. */
export const FLOW_PARTICLE_COUNT = 4000;
export const FLOW_PARTICLE_TRAIL = 18;
export const FLOW_PARTICLE_SIZE_M = 0.05;
/**
 * 머리(원)의 화면 크기 한계(px). 월드 크기(FLOW_PARTICLE_SIZE_M)만 쓰면 확대할수록 원이
 * 무한정 커져 1px 꼬리선과의 비율이 벌어진다(2026-10-27 사용자: "원과 라인에 비율이 크지 않아").
 * 온도 측 샘플 뷰어도 같은 방식이다 — gl_PointSize를 clamp(uSize*uScale/-z, 1.5, 7)로 자른다.
 */
export const FLOW_PARTICLE_MIN_PX = 1.5;
export const FLOW_PARTICLE_MAX_PX = 7;
/**
 * 입자 수명(화면 초) — 이 시간이 지나면 급기구에서 다시 내보낸다. **지금은 끈다(undefined)**.
 *
 * 왜 넣었나(2026-10-27): 유속이 288점뿐인 전문가·제어 목업은 방 안 흐름이 한 곳으로 수렴해서,
 * 그냥 두면 입자가 모두 그 자리에 겹쳐 2분 만에 화면이 비어 보였다(실측: 보이는 입자 10여 개).
 * 온도 측 샘플은 멈춘 입자를 방 안 아무 곳에 다시 뿌려 이를 피하는데, 그러면 사방에서 입자가
 * 생겨 보여서 급기구에서 주기적으로 다시 내보내는 쪽을 썼다.
 *
 * 왜 끄나(2026-10-28 온도 측 회신 2번): "일정 시간 멈춰 있으면 다시 출발시키는 정도면
 * 충분합니다" — 멈춘 입자를 방 안 아무 곳에서 다시 출발시키는 샘플 규칙을 되살렸으므로
 * (detail/flowParticles.ts STUCK_HOLD_S) 수명으로 급기구에 몰아 줄 필요가 없다. 20초마다
 * 전부 급기구로 끌어오면 1배속에서 입자가 천장 근처에만 몰려 방 전체가 비어 보인다.
 * 되살리려면 숫자(초)를 넣으면 된다.
 */
export const FLOW_PARTICLE_MAX_AGE_S: number | undefined = undefined;

/**
 * 배기구 소멸 판정 — 'circle'이 온도 측 안내문("화면 구현 참고")이 권한 방식이고,
 * 'cell'은 배기구 격자점이 걸친 격자 한 칸이다(detail/flowParticles.ts의 atOutlet).
 *
 * 실제 v1.3.3 예측 응답 첫 프레임으로 60초(10배속) 모의한 결과 — 입자 4,000개 기준:
 *   circle : 배기구로 5,085회 사라짐, **배기구 벽에 붙어 있는 입자 2,399개**(전부 원 바깥)
 *   cell   : 배기구로 14,522회 사라짐, 벽에 붙은 입자 21개
 * 배기구 둘레 격자점이 0(벽면 조건)이라 원 바깥에서 속도가 0으로 줄어 붙는다. 그래서 기본은
 * 'cell'로 두고, 온도 측에 어느 쪽이 맞는지 확인 요청 중이다(2026-10-28). 답이 오면 한 줄로 바꾼다.
 */
export const FLOW_PARTICLE_OUTLET_HIT: OutletHit = 'circle';
/**
 * 배속 선택지 — 안내문의 1·3·10배. 화면 1초 = 실제 몇 초. 입자와 타임라인 재생에 함께 걸린다
 * (타임라인 프레임 간격 = TIMELINE_FRAME_DURATION_MS ÷ 배속, 2026-10-28 사용자).
 */
export const FLOW_PARTICLE_SPEEDS = [1, 3, 10] as const;
export type FlowParticleSpeed = (typeof FLOW_PARTICLE_SPEEDS)[number];
/**
 * 기본 배속 1배(2026-10-28 사용자) — 온도 측 안내 "방 안 유속이 작아서 샘플은 입자를 실제 속도의
 * 1·3·10배로 움직였습니다"와 샘플 뷰어의 배속·타임라인 연동에 맞췄다. 1배는 실제 속도라 방 안
 * 평균 0.02 m/s로 거의 멈춰 보인다 — 빠르게 보려면 3·10배를 고른다. 전에는 그 이유로 10배였다.
 */
export const FLOW_PARTICLE_DEFAULT_SPEED: FlowParticleSpeed = 1;
/**
 * supply가 없을 때(viz 꺼짐·구버전 서버) 쓰는 급기 풍량(m³/h) — 온도 측 2026-10-27:
 * 환기팬 가동률에 따라 보통 약 770~1,240 m³/h, 그 최댓값.
 */
export const FLOW_PARTICLE_FALLBACK_AIRFLOW_M3H = 1240;
