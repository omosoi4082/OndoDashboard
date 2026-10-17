import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  WALL_FADE_DEFAULTS,
  createWallFade,
  fadeOpacity,
  outwardSign,
  smoothstep,
  wallNormalAxis,
} from './wallFade.js';

describe('smoothstep', () => {
  it('구간 밖은 0과 1로 잘린다', () => {
    expect(smoothstep(0.25, -1)).toBe(0);
    expect(smoothstep(0.25, 0)).toBe(0);
    expect(smoothstep(0.25, 0.25)).toBe(1);
    expect(smoothstep(0.25, 9)).toBe(1);
  });

  it('가운데는 0.5 (S자 곡선)', () => {
    expect(smoothstep(0.25, 0.125)).toBeCloseTo(0.5, 6);
  });

  it('band가 0이면 계단 함수 — 컬링과 같아진다', () => {
    expect(smoothstep(0, -0.001)).toBe(0);
    expect(smoothstep(0, 0.001)).toBe(1);
    expect(smoothstep(0, 0)).toBe(0);
  });
});

describe('wallNormalAxis', () => {
  it('더 얇은 수평축이 법선축이다', () => {
    expect(wallNormalAxis({ x: 0.2, z: 12 })).toBe('x'); // 긴 벽, 법선은 x
    expect(wallNormalAxis({ x: 7.5, z: 0.2 })).toBe('z'); // 짧은 벽, 법선은 z
  });
});

describe('outwardSign', () => {
  // 건물 외곽이 −10 ~ +10이라고 보자.
  it('외곽에 붙은 벽은 바깥 방향을 돌려준다', () => {
    expect(outwardSign(9.8, -10, 10, 0.6)).toBe(1); // +쪽 외벽
    expect(outwardSign(-9.8, -10, 10, 0.6)).toBe(-1); // −쪽 외벽
  });

  it('가운데 칸막이벽은 null — 페이드 대상이 아니다', () => {
    expect(outwardSign(0, -10, 10, 0.6)).toBeNull();
    expect(outwardSign(3.5, -10, 10, 0.6)).toBeNull();
  });

  it('edgeTolerance 경계', () => {
    expect(outwardSign(9.4, -10, 10, 0.6)).toBe(1); // 정확히 0.6 떨어짐 → 외벽
    expect(outwardSign(9.3, -10, 10, 0.6)).toBeNull(); // 0.7 → 칸막이
  });
});

describe('fadeOpacity', () => {
  const { band, keep } = WALL_FADE_DEFAULTS;

  it('카메라 반대편 벽(facing ≤ 0)은 불투명하게 남는다', () => {
    expect(fadeOpacity(-1, band, keep)).toBe(1);
    expect(fadeOpacity(0, band, keep)).toBe(1);
  });

  it('정면으로 가로막는 벽은 keep 농도까지 옅어진다 — 완전히 지우지 않는다', () => {
    expect(fadeOpacity(1, band, keep)).toBeCloseTo(keep, 6);
  });

  it('keep이 0이면 완전히 사라진다', () => {
    expect(fadeOpacity(1, band, 0)).toBe(0);
  });

  it('band 안에서는 부드럽게 변한다(중간값이 양 끝 사이)', () => {
    const mid = fadeOpacity(band / 2, band, keep);
    expect(mid).toBeLessThan(1);
    expect(mid).toBeGreaterThan(keep);
  });
});

/** 건물 외곽 −10~10(x), −5~5(z)에 외벽 4장 + 가운데 칸막이 1장을 둔 가짜 모델. */
function buildFakeBarn(): THREE.Group {
  const root = new THREE.Group();
  const add = (name: string, size: [number, number, number], pos: [number, number, number], matName: string): void => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      new THREE.MeshStandardMaterial({ name: matName }),
    );
    mesh.name = name;
    mesh.position.set(...pos);
    root.add(mesh);
  };
  add('Wall_Xmin', [0.2, 3, 10], [-10, 1.5, 0], 'GLTF_Wall');
  add('Wall_Xmax', [0.2, 3, 10], [10, 1.5, 0], 'GLTF_Wall');
  add('Wall_Zmin', [20, 3, 0.2], [0, 1.5, -5], 'GLTF_Wall');
  add('Wall_Zmax', [20, 3, 0.2], [0, 1.5, 5], 'GLTF_Wall');
  add('Partition', [0.2, 3, 10], [0, 1.5, 0], 'GLTF_Wall'); // 가운데 칸막이
  add('Floor', [24, 0.2, 12], [0, 0, 0], 'GLTF_Slat'); // 벽보다 넓은 바닥(외곽 계산에서 빠져야 함)
  root.updateMatrixWorld(true);
  return root;
}

describe('createWallFade', () => {
  it('외벽만 잡고 칸막이·바닥은 건너뛴다', () => {
    const fade = createWallFade(buildFakeBarn());
    expect(fade.count).toBe(4);
    fade.dispose();
  });

  it('카메라 쪽 벽만 투명해지고 반대편은 불투명하게 남는다', () => {
    const root = buildFakeBarn();
    const fade = createWallFade(root);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(40, 2, 0); // +x 바깥에서 바라본다

    fade.update(camera);

    const opacityOf = (name: string): number => {
      const mesh = root.getObjectByName(name) as THREE.Mesh;
      const mat = mesh.material as THREE.Material & { opacity: number };
      return mat.opacity;
    };
    expect(opacityOf('Wall_Xmax')).toBeLessThan(0.3); // 가로막는 벽
    expect(opacityOf('Wall_Xmin')).toBe(1); // 반대편 벽
    fade.dispose();
  });

  it("mode 'opaque'면 전부 불투명으로 되돌린다", () => {
    const root = buildFakeBarn();
    const fade = createWallFade(root);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(40, 2, 0);

    fade.update(camera);
    fade.setMode('opaque');
    fade.update(camera);

    const mesh = root.getObjectByName('Wall_Xmax') as THREE.Mesh;
    const mat = mesh.material as THREE.Material & { opacity: number };
    expect(mat.opacity).toBe(1);
    expect(mesh.visible).toBe(true);
    fade.dispose();
  });

  it("mode 'cull'은 가로막는 벽을 통째로 숨긴다", () => {
    const root = buildFakeBarn();
    const fade = createWallFade(root, { mode: 'cull' });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(40, 2, 0);
    fade.update(camera);

    expect((root.getObjectByName('Wall_Xmax') as THREE.Mesh).visible).toBe(false);
    expect((root.getObjectByName('Wall_Xmin') as THREE.Mesh).visible).toBe(true);
    fade.dispose();
  });

  // 2026-10-17 실제로 겪은 버그: StrictMode의 마운트→언마운트→재마운트에서 dispose()가
  // walls를 비우는데, useMemo가 같은 객체를 재사용해 update()가 조용히 아무 일도 안 했다.
  // 고친 쪽은 OverviewScene(생성·정리를 같은 effect에 묶음)이지만, "dispose 뒤에는 죽은
  // 객체"라는 성질을 여기 못 박아 둔다 — 재사용하면 안 된다는 근거가 된다.
  it('dispose한 객체는 update해도 아무 일도 하지 않는다 — 재사용 금지', () => {
    const root = buildFakeBarn();
    const fade = createWallFade(root);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(40, 2, 0);

    fade.dispose();
    expect(fade.count).toBe(0);

    fade.update(camera); // 죽은 객체 — 던지지 않고 조용히 아무 일도 안 한다
    const mesh = root.getObjectByName('Wall_Xmax') as THREE.Mesh;
    const mat = mesh.material as THREE.Material & { opacity: number };
    expect(mat.opacity).toBe(1);
  });

  it('dispose 뒤 다시 만들면 정상 동작한다 — 재마운트 경로', () => {
    const root = buildFakeBarn();
    createWallFade(root).dispose();

    const again = createWallFade(root);
    expect(again.count).toBe(4);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(40, 2, 0);
    again.update(camera);

    const mesh = root.getObjectByName('Wall_Xmax') as THREE.Mesh;
    const mat = mesh.material as THREE.Material & { opacity: number };
    expect(mat.opacity).toBeLessThan(0.3);
    again.dispose();
  });

  it('dispose하면 원본 머티리얼로 되돌아가고 전부 보인다', () => {
    const root = buildFakeBarn();
    const before = (root.getObjectByName('Wall_Xmax') as THREE.Mesh).material;
    const fade = createWallFade(root);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(40, 2, 0);
    fade.update(camera);
    fade.dispose();

    const mesh = root.getObjectByName('Wall_Xmax') as THREE.Mesh;
    expect(mesh.material).toBe(before);
    expect(mesh.visible).toBe(true);
    expect(fade.count).toBe(0);
  });
});
