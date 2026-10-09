import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  BARN_NODE_CONFIG,
  computeBarnSections,
  computeRotationCenter,
  findBarnNodes,
  findSection,
  groundAndCenterModel,
  resolveRoomId,
  sanitizeNodeName,
  unionSectionsBox,
} from './barnModel.js';

function boxMesh(name: string, size: [number, number, number], position: [number, number, number]): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size));
  mesh.name = name;
  mesh.position.set(...position);
  return mesh;
}

/** weaner_room_test-001.glb과 비슷한 모양(루트 아래 P1 노드 1개, Grower_/Finisher_ 접두사 낱개 노드들)의 가짜 모델. */
function buildFakeModel(): THREE.Group {
  const root = new THREE.Group();
  root.add(boxMesh('P1', [2, 2, 2], [0, 1, 0]));
  root.add(boxMesh('Grower_W0', [1, 1, 1], [5, 0.5, 0]));
  root.add(boxMesh('Grower_W1', [1, 1, 1], [6, 0.5, 0]));
  root.add(boxMesh('Finisher_W0', [1, 1, 1], [10, 0.5, 0]));
  root.add(boxMesh('Unrelated_Duct', [0.5, 0.5, 0.5], [20, 2, 0]));
  root.updateMatrixWorld(true);
  return root;
}

describe('sanitizeNodeName', () => {
  it('공백은 밑줄로, 예약 문자([ ] . : /)는 제거한다(GLTFLoader 정제 규칙과 동일)', () => {
    expect(sanitizeNodeName('P1.001')).toBe('P1001');
    expect(sanitizeNodeName('Grower_Room A')).toBe('Grower_Room_A');
    expect(sanitizeNodeName('a[0].b:c/d')).toBe('a0bcd');
  });
});

describe('findBarnNodes', () => {
  it('modelNodeName은 정확히 일치하는 노드 하나만 찾는다', () => {
    const root = buildFakeModel();
    const nodes = findBarnNodes(root, { roomId: 'NH', modelNodeName: 'P1' });
    expect(nodes.map((n) => n.name)).toEqual(['P1']);
  });

  it('modelNodePrefix는 그 접두사로 시작하는 노드를 전부 찾는다', () => {
    const root = buildFakeModel();
    const nodes = findBarnNodes(root, { roomId: 'GH', modelNodePrefix: 'Grower_' });
    expect(nodes.map((n) => n.name).sort()).toEqual(['Grower_W0', 'Grower_W1']);
  });

  it('찾지 못하면 빈 배열을 반환한다', () => {
    const root = buildFakeModel();
    expect(findBarnNodes(root, { roomId: 'NH', modelNodeName: 'NoSuchNode' })).toEqual([]);
  });
});

describe('groundAndCenterModel', () => {
  it('모델을 수평 중심에 맞추고 바닥(y=0)에 붙인다', () => {
    const root = buildFakeModel();
    groundAndCenterModel(root);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    expect(box.min.y).toBeCloseTo(0, 5);
  });

  it('두 번 호출해도(StrictMode 이중 실행) 위치가 또 바뀌지 않는다(멱등)', () => {
    const root = buildFakeModel();
    groundAndCenterModel(root);
    const posAfterFirst = root.position.clone();
    groundAndCenterModel(root);
    expect(root.position.toArray()).toEqual(posAfterFirst.toArray());
  });
});

describe('computeBarnSections', () => {
  it('BARN_NODE_CONFIG 기준으로 방별 center·size를 계산하고 매칭된 노드에 userData.roomId를 태깅한다', () => {
    const root = buildFakeModel();
    const sections = computeBarnSections(root, BARN_NODE_CONFIG);

    const roomIds = sections.map((s) => s.roomId).sort();
    expect(roomIds).toEqual(['FH', 'GH', 'NH']);

    const nh = findSection(sections, 'NH');
    expect(nh).not.toBeNull();
    expect(nh?.size.toArray()).toEqual([2, 2, 2]);

    const p1 = root.getObjectByName('P1');
    expect(p1?.userData.roomId).toBe('NH');
  });

  it('노드를 찾지 못한 방은 결과에서 생략한다', () => {
    const root = buildFakeModel();
    const sections = computeBarnSections(root, [{ roomId: 'NH', modelNodeName: 'NoSuchNode' }]);
    expect(sections).toEqual([]);
  });
});

describe('resolveRoomId', () => {
  it('맞은 메시 자신에게 roomId가 있으면 그대로 반환한다', () => {
    const mesh = boxMesh('X', [1, 1, 1], [0, 0, 0]);
    mesh.userData.roomId = 'GH';
    expect(resolveRoomId(mesh)).toBe('GH');
  });

  it('부모 쪽으로 올라가며 가장 가까운 roomId를 찾는다', () => {
    const root = buildFakeModel();
    const sections = computeBarnSections(root, BARN_NODE_CONFIG);
    expect(sections.length).toBeGreaterThan(0);
    const child = root.getObjectByName('P1')?.children[0] ?? root.getObjectByName('P1');
    expect(resolveRoomId(child ?? null)).toBe('NH');
  });

  it('roomId가 태깅된 조상이 없으면 null', () => {
    const mesh = boxMesh('Unrelated', [1, 1, 1], [0, 0, 0]);
    expect(resolveRoomId(mesh)).toBeNull();
  });
});

describe('unionSectionsBox / computeRotationCenter', () => {
  it('sections가 없으면 null', () => {
    expect(unionSectionsBox([])).toBeNull();
  });

  it('sections 전체를 감싸는 박스를 반환한다', () => {
    const root = buildFakeModel();
    const sections = computeBarnSections(root, BARN_NODE_CONFIG);
    const box = unionSectionsBox(sections);
    expect(box).not.toBeNull();
    // Grower_/Finisher_만 보면 x 10.5 부근까지 뻗어있어야 함(바닥 정렬 후에도 x 상대 위치는 유지).
    expect(box!.max.x).toBeGreaterThan(box!.min.x);
  });

  it('primaryRoomId 방향으로 weight만큼 치우친 회전 중심을 계산한다', () => {
    const root = buildFakeModel();
    const sections = computeBarnSections(root, BARN_NODE_CONFIG);
    const box = unionSectionsBox(sections)!;
    const boxCenter = box.getCenter(new THREE.Vector3());
    const nh = findSection(sections, 'NH')!;

    const rotationCenter = computeRotationCenter(sections, box, 'NH', 0.5);
    expect(rotationCenter).not.toBeNull();
    // weight=0.5면 전체 중심과 NH 중심의 중간점.
    const expectedX = (boxCenter.x + nh.center.x) / 2;
    expect(rotationCenter!.x).toBeCloseTo(expectedX, 5);
  });

  it('primaryRoomId 방을 찾지 못하면 null', () => {
    const root = buildFakeModel();
    const sections = computeBarnSections(root, [{ roomId: 'GH', modelNodePrefix: 'Grower_' }]);
    const box = unionSectionsBox(sections)!;
    expect(computeRotationCenter(sections, box, 'NH', 0.5)).toBeNull();
  });
});
