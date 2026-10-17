import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WALL_CAP_COLOR, normalizeWallCapMaterial } from './barnMaterials.js';

/** 캡 10장이 머티리얼 하나를 공유하는 실제 모델 구조를 흉내 낸다. */
function buildScene(): { root: THREE.Group; shared: THREE.MeshStandardMaterial } {
  const root = new THREE.Group();
  const shared = new THREE.MeshStandardMaterial({ name: 'GLTF_WallCap', map: new THREE.Texture() });
  for (let i = 0; i < 3; i += 1) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
    mesh.name = `Cap_${i}`;
    root.add(mesh);
  }
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ name: 'GLTF_Wall', map: new THREE.Texture() }),
  );
  wall.name = 'Wall';
  root.add(wall);
  return { root, shared };
}

describe('normalizeWallCapMaterial', () => {
  it('캡 머티리얼의 무늬를 떼고 단색 회색으로 칠한다', () => {
    const { root, shared } = buildScene();
    normalizeWallCapMaterial(root);
    expect(shared.map).toBeNull();
    expect(shared.color.getHex()).toBe(WALL_CAP_COLOR);
  });

  it('벽 머티리얼은 건드리지 않는다 — 벽 패널 무늬는 그대로여야 한다', () => {
    const { root } = buildScene();
    normalizeWallCapMaterial(root);
    const wall = root.getObjectByName('Wall') as THREE.Mesh;
    const mat = wall.material as THREE.MeshStandardMaterial;
    expect(mat.map).not.toBeNull();
  });

  it('공유 머티리얼이라 한 번만 손본다(멱등) — 재마운트에도 안전', () => {
    const { root } = buildScene();
    expect(normalizeWallCapMaterial(root)).toBe(1);
    expect(normalizeWallCapMaterial(root)).toBe(0);
  });

  it('색을 직접 줄 수도 있다', () => {
    const { root, shared } = buildScene();
    normalizeWallCapMaterial(root, 0x808080);
    expect(shared.color.getHex()).toBe(0x808080);
  });

  it('모델이 이미 단색 캡을 주면 그 색을 건드리지 않는다 — 모델 수정과 충돌 방지', () => {
    const root = new THREE.Group();
    // 맵 없이 단색으로 온 캡(= 모델 쪽에서 이미 고쳐 내보낸 경우).
    const flat = new THREE.MeshStandardMaterial({ name: 'GLTF_WallCap', color: 0x999999 });
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), flat));

    expect(normalizeWallCapMaterial(root)).toBe(0);
    expect(flat.color.getHex()).toBe(0x999999);
  });

  it('캡 머티리얼이 없는 모델이면 조용히 넘어간다 — 모델 교체에 대비', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'Other' })));
    expect(normalizeWallCapMaterial(root)).toBe(0);
  });
});
