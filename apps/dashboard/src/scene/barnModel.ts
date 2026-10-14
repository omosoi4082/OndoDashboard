// technical-review/pig-farm-cfd-demo/src/config.js + barnFactory.js에서 포팅한
// 메인 화면(자돈·육성·비육 3방 통합 실측 모델) 데이터 연결 로직(docs/07-starter-kit-assets.md).
// 물리/수학(바운딩박스·정렬) 로직은 그대로 두고, BARNS(숫자 id) 대신 이 프로젝트의 RoomId로
// 바로 매핑했다. 메인 화면 전용 — 상세 패널(Detail3DView)은 geometry.room.size 기준 와이어
//프레임을 그대로 쓴다(M3 범위, 건드리지 않음).
import * as THREE from 'three';
import type { RoomId } from '@ondo/shared';

// 2026-10-09 교체본 — 자돈(P1 단일 노드)·육성(Grower_ 접두사)·비육(Finisher_ 접두사) 3방이
// 하나로 붙은 실측 모델. public/assets/models에 복사해 Vite가 정적으로 서빙한다.
// 머티리얼은 glb에 들어 있는 것을 그대로 쓴다(육성·비육 회색 PigRoom_Gray 포함) — 코드에서
// 덮어쓰지 않는다.
export const OVERVIEW_MODEL_URL = '/assets/models/weaner_room_test_op.glb';

export interface BarnNodeConfig {
  roomId: RoomId;
  /** 노드 이름 "정확히 일치"(자돈/P1처럼 방 전체가 노드 하나). */
  modelNodeName?: string;
  /** 이 접두사로 시작하는 노드를 전부 묶는다(육성/비육처럼 낱개 노드로만 구성된 경우). */
  modelNodePrefix?: string;
}

// config.js의 BARNS 배열 순서·매칭 기준 그대로 — RoomId NH(자돈)/GH(육성)/FH(비육)에 대응.
//
// 2026-10-14: 육성·비육에 방 껍데기 노드(P1.005·P1.006 = 바닥 슬래브 + 벽 4면, 아래 Cube.018~025)를
// 추가했다. 그 전에는 Grower_/Finisher_ 접두사만 봐서 **칸막이벽과 팬만** 방으로 잡혔다 —
// 두 방의 바닥·벽에는 roomId가 안 붙어 호버해도 정보 판넬이 안 떴고, 방 바운딩박스도
// 실제 방(7.5 m·12 m)이 아니라 2.9 m·6.8 m로 작게 잡혀 이름표·돼지 배치 기준이 어긋났다.
// 이름이 Cube.0XX로 남아 접두사에 안 걸린 것뿐이고 실제로는 방 모델이다(아래 2026-10-09 주석).
export const BARN_NODE_CONFIG: readonly BarnNodeConfig[] = [
  { roomId: 'NH', modelNodeName: 'P1' },
  { roomId: 'GH', modelNodeName: 'P1.005', modelNodePrefix: 'Grower_' },
  { roomId: 'FH', modelNodeName: 'P1.006', modelNodePrefix: 'Finisher_' },
];

// 상세보기(컷어웨이) 전용 "판(두께 없음)" 대체 벽 노드 — 메인 화면은 두꺼운 벽을 그대로
// 쓰므로 있으면 숨긴다(barnFactory.js loadBarnComplex 참고, 없으면 조용히 무시).
const FLAT_WALL_NODE_NAMES = ['PigRoom_Walls_Flat', 'PigRoom_Roof_Flat'];

// 2026-10-09: 한때 "P1.005/P1.006(Cube.018~025)을 디버그용 더미로 보고 숨김" 처리를
// 시도했으나 오판이었다 — 월드 크기를 다시 계산해보니 각각 8m×5.6m급 패널 4개 조합으로,
// 실제로는 육성·비육방의 바닥+벽 모델링이었다(이름만 Grower_/Finisher_ 접두사가 아니라
// Cube.0XX로 잘못 남아있었을 뿐). 숨기면 육성·비육방이 통째로 사라지므로 절대 숨기지
// 않는다 — 이 주석은 같은 실수를 반복하지 않기 위한 기록이다.

// GLTFLoader가 노드 이름에서 애니메이션 바인딩 예약 문자 [ ] . : / 를 제거하는 규칙과 동일
// (three.js PropertyBinding.sanitizeNodeName) — config의 "P1"/"Grower_"는 사람이 읽기 쉬운
// 원본 이름이라 조회 전에 같은 규칙으로 정제한다.
export function sanitizeNodeName(name: string): string {
  return name.replace(/\s/g, '_').replace(/[[\].:/]/g, '');
}

/**
 * config.modelNodeName(정확히 일치하는 노드 하나)과 config.modelNodePrefix(그 접두사로
 * 시작하는 노드 전부)를 모두 모아 반환한다 — 한 방이 "방 껍데기 노드 하나 + 접두사 노드
 * 여러 개"로 쪼개져 있는 경우(육성·비육)가 있어 둘을 같이 쓸 수 있다.
 */
export function findBarnNodes(modelRoot: THREE.Object3D, config: BarnNodeConfig): THREE.Object3D[] {
  const matched: THREE.Object3D[] = [];
  if (config.modelNodeName) {
    const node = modelRoot.getObjectByName(sanitizeNodeName(config.modelNodeName));
    if (node) matched.push(node);
  }
  if (config.modelNodePrefix) {
    const prefix = sanitizeNodeName(config.modelNodePrefix);
    modelRoot.traverse((obj) => {
      if (obj.name && obj.name.startsWith(prefix)) matched.push(obj);
    });
  }
  return matched;
}

/** hit(레이캐스트로 맞은 메시)에서 부모 쪽으로 올라가며 가장 가까운 userData.roomId를 찾는다. */
export function resolveRoomId(object: THREE.Object3D | null): RoomId | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const roomId = current.userData.roomId as RoomId | undefined;
    if (roomId) return roomId;
    current = current.parent;
  }
  return null;
}

// 모델 전체를 수평 중심 기준으로 정렬하고 바닥(y=0)에 붙인다. 내부 방 노드들 사이의
// 상대 위치(서로 붙어있는 구조)는 그대로 유지된다. userData 플래그로 멱등성을 보장해서
// (React StrictMode의 이펙트 이중 실행 등) 같은 모델에 두 번 호출돼도 안전하다.
export function groundAndCenterModel(modelRoot: THREE.Object3D): void {
  if (modelRoot.userData.ondoGrounded) return;
  modelRoot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(modelRoot);
  const center = new THREE.Vector3();
  box.getCenter(center);
  modelRoot.position.x -= center.x;
  modelRoot.position.z -= center.z;
  modelRoot.position.y -= box.min.y;
  modelRoot.userData.ondoGrounded = true;
  modelRoot.updateMatrixWorld(true);
}

export interface BarnSection {
  roomId: RoomId;
  /** 월드 좌표(Three.js, y-up) — 모델 자체가 이미 Three 공간이라 zUpToYUp 변환이 필요 없다. */
  center: THREE.Vector3;
  size: THREE.Vector3;
}

/**
 * 모델을 정렬하고, BARN_NODE_CONFIG별로 노드를 찾아 userData.roomId를 태깅한 뒤 방별
 * 바운딩박스(center·size)를 계산한다. 노드를 찾지 못한 방은 결과에서 생략한다.
 */
export function computeBarnSections(
  modelRoot: THREE.Object3D,
  configs: readonly BarnNodeConfig[] = BARN_NODE_CONFIG,
): BarnSection[] {
  groundAndCenterModel(modelRoot);
  modelRoot.updateMatrixWorld(true);

  for (const name of FLAT_WALL_NODE_NAMES) {
    const node = modelRoot.getObjectByName(sanitizeNodeName(name));
    if (node) node.visible = false;
  }

  const sections: BarnSection[] = [];
  for (const config of configs) {
    const nodes = findBarnNodes(modelRoot, config);
    if (nodes.length === 0) continue;

    const box = new THREE.Box3();
    for (const node of nodes) {
      node.userData.roomId = config.roomId;
      box.expandByObject(node);
    }
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    sections.push({ roomId: config.roomId, center, size });
  }
  return sections;
}

/**
 * 방 이름표·정보 판넬을 붙일 벽 — **원형 환기구(배기구 `outlet_model`)가 있는 서쪽 긴 벽**
 * (2026-10-14 사용자 요청: "원형 환기구 있는 벽으로 위치이동"). 세 방 모두 같은 쪽이다
 * (모델 실측: 배기구 x 자돈 −2.03 / 육성·비육 −1.96, 벽 바깥면은 셋 다 x −2.01).
 * 육성·비육 벽은 이름이 `Cube.0XX`로 남아 있다(BARN_NODE_CONFIG 주석 참고).
 */
const ROOM_LABEL_WALL_NODE: Record<RoomId, string> = {
  NH: 'PigRoom_Wall_W',
  GH: 'Cube.020',
  FH: 'Cube.023',
};

/**
 * 이름표 앵커 = 환기구 벽의 바깥면(x) · 벽 윗변(y) · 방 길이 방향 가운데(z).
 *
 * 방 바운딩박스를 그대로 쓰면 지붕 처마(x −2.19)와 천정 급기팬(y 3.45)까지 포함돼 이름표가
 * 벽에서 뜨고 너무 높이 뜬다(2026-10-14 사용자: "조금 내려서 벽쪽에 가까이 해줘").
 * 벽 노드를 못 찾으면 예전처럼 박스 모서리로 떨어진다.
 */
export function roomLabelAnchor(modelRoot: THREE.Object3D, section: BarnSection): THREE.Vector3 {
  const wall = modelRoot.getObjectByName(sanitizeNodeName(ROOM_LABEL_WALL_NODE[section.roomId]));
  if (!wall) {
    return new THREE.Vector3(
      section.center.x - section.size.x / 2,
      section.center.y + section.size.y / 2,
      section.center.z,
    );
  }
  const box = new THREE.Box3().setFromObject(wall);
  return new THREE.Vector3(box.min.x, box.max.y, section.center.z);
}

export function findSection(sections: readonly BarnSection[], roomId: RoomId): BarnSection | null {
  return sections.find((s) => s.roomId === roomId) ?? null;
}

/** sections 전체를 감싸는 Box3 — 초기 카메라 프레이밍 기준(overviewScene.js loadedFrameBox). */
export function unionSectionsBox(sections: readonly BarnSection[]): THREE.Box3 | null {
  if (sections.length === 0) return null;
  return sections.reduce<THREE.Box3 | null>((acc, s) => {
    const box = new THREE.Box3().setFromCenterAndSize(s.center, s.size);
    return acc ? acc.union(box) : box;
  }, null);
}

/**
 * 회전 중심(= controls.target)을 전체 박스 중심에서 primaryRoomId 방 중심 방향으로
 * weight만큼 옮긴다 — 자돈방 쪽에 여유를 주기 위함(overviewScene.js, 2026-10-09).
 * primaryRoomId 방을 찾지 못하면 null(호출 측은 box 중심을 그대로 쓴다).
 */
export function computeRotationCenter(
  sections: readonly BarnSection[],
  box: THREE.Box3,
  primaryRoomId: RoomId,
  weight = 0.5,
): THREE.Vector3 | null {
  const primary = findSection(sections, primaryRoomId);
  if (!primary) return null;
  return box.getCenter(new THREE.Vector3()).lerp(primary.center, weight);
}
