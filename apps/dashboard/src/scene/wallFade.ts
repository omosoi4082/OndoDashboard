// 메인 화면 앞벽 페이드 — 카메라와 실내 사이를 가로막는 외벽을 매 프레임 투명하게 만든다.
// 2026-10-17 사용자 제공 `E:/modeling/gltf/wall-fade.js`를 TypeScript로 포팅했다
// (원본 주석·옵션 이름·수식 그대로. 모델 제작자가 weaner_barn.glb에 맞춰 쓴 코드라 판정
// 기준인 머티리얼 이름 `GLTF_Wall`·`GLTF_WallCap`도 그 모델 기준이다).
//
// glTF 머티리얼에는 카메라 방향에 반응하는 기능이 없어서 뷰어에서 계산한다. 비용은 외벽
// 개수만큼의 내적(이 모델은 8회/프레임)이고, 완전히 투명해진 벽은 draw를 건너뛰므로
// 불투명보다 오히려 가볍다.
//
// 동작: facing = -dot(벽 바깥법선, normalize(벽중심 − 카메라위치))
//   facing > 0 → 카메라가 벽 바깥쪽 = 이 벽이 실내를 가린다 → 투명해짐
//   불투명도 = 1 − smoothstep(0, band, facing) × (1 − keep)
//
// 수학(외벽 판정·불투명도)은 순수 함수로 떼어 테스트한다(CLAUDE.md 규칙).
import * as THREE from 'three';

export interface WallFadeOptions {
  /** 페이드 대상 머티리얼 이름. */
  wallMaterial: string;
  /** 벽 윗면 캡 — 외곽 계산에는 쓰고 페이드는 하지 않는다. */
  capMaterial: string;
  /** 건물 외곽선에서 이 거리(m) 안이면 외벽으로 본다. */
  edgeTolerance: number;
  /** 페이드 폭. 0이면 컬링처럼 툭 끊긴다. */
  band: number;
  /** 앞벽을 완전히 지우지 않고 남길 농도(0~1). */
  keep: number;
  mode: 'fade' | 'cull' | 'opaque';
}

export const WALL_FADE_DEFAULTS: WallFadeOptions = {
  wallMaterial: 'GLTF_Wall',
  capMaterial: 'GLTF_WallCap',
  edgeTolerance: 0.6,
  band: 0.25,
  keep: 0.12,
  mode: 'fade',
};

// ── 순수 함수 ──────────────────────────────────────────────────────────────

/** 원본의 smoothstep(edge0=0, edge1=edge). edge가 0 이하면 계단 함수. */
export function smoothstep(edge: number, x: number): number {
  if (edge <= 0) return x > 0 ? 1 : 0;
  const t = Math.min(1, Math.max(0, x / edge));
  return t * t * (3 - 2 * t);
}

/**
 * 벽 메시의 바운딩박스에서 **가장 얇은 수평축**이 벽의 법선축이다.
 * 원본과 같이 x와 z만 비교한다(벽은 세워져 있어 y는 항상 두껍다).
 */
export function wallNormalAxis(size: { x: number; z: number }): 'x' | 'z' {
  return size.x < size.z ? 'x' : 'z';
}

/**
 * 법선축 좌표가 건물 외곽선에 붙어 있으면 외벽, 가운데면 방 사이 칸막이벽이다.
 * 외벽이면 바깥 방향(+1 / −1)을, 칸막이벽이면 null을 돌려준다.
 *
 * 이름으로 찾지 않는 이유(원본 주석): three.js GLTFLoader가 노드 이름에서 점을 지워
 * `Cube.019`가 `Cube019`가 되어 버린다. 형상으로 판정하면 이름 변화에 영향받지 않는다.
 */
export function outwardSign(
  center: number,
  outlineMin: number,
  outlineMax: number,
  edgeTolerance: number,
): 1 | -1 | null {
  const dMin = Math.abs(center - outlineMin);
  const dMax = Math.abs(center - outlineMax);
  if (Math.min(dMin, dMax) > edgeTolerance) return null; // 칸막이벽
  return dMax < dMin ? 1 : -1;
}

/** facing(−1~1) → 불투명도. mode별 분기는 호출부에서 처리한다. */
export function fadeOpacity(facing: number, band: number, keep: number): number {
  return 1 - smoothstep(band, facing) * (1 - keep);
}

// ── 씬에 붙이기 ────────────────────────────────────────────────────────────

interface FadeWall {
  mesh: THREE.Mesh;
  material: THREE.Material & { opacity: number; transparent: boolean; depthWrite: boolean };
  original: THREE.Material;
  /** glb 원본의 side(이 모델은 전부 DoubleSide) — 불투명 상태로 돌아갈 때 되돌린다. */
  originalSide: THREE.Side;
  center: THREE.Vector3;
  outward: THREE.Vector3;
  name: string;
}

export interface WallFade {
  /** 카메라를 움직인 뒤, 렌더 직전에 부른다. */
  update: (camera: THREE.Camera) => void;
  /** 머티리얼 복제본을 버리고 원본으로 되돌린다. */
  dispose: () => void;
  /** 잡힌 외벽 수(이 모델은 8이 정상). */
  readonly count: number;
  setMode: (mode: WallFadeOptions['mode']) => void;
}

export function createWallFade(
  scene: THREE.Object3D,
  options: Partial<WallFadeOptions> = {},
): WallFade {
  const opt: WallFadeOptions = { ...WALL_FADE_DEFAULTS, ...options };

  // ── 1. 벽 메시 수집 + 벽만으로 건물 외곽 산출 ──
  // 바닥이 벽보다 넓게 튀어나온 모델이 있어서, 외곽은 반드시 '벽'으로만 잡는다(원본 주석).
  const bodies: { mesh: THREE.Mesh; box: THREE.Box3 }[] = [];
  const wallBox = new THREE.Box3();

  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.material) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    const name = materials[0]?.name;
    if (name !== opt.wallMaterial && name !== opt.capMaterial) return;
    const box = new THREE.Box3().setFromObject(o);
    wallBox.union(box);
    if (name === opt.wallMaterial) bodies.push({ mesh: o, box });
  });

  // ── 2. 외벽 판별 ──
  const walls: FadeWall[] = [];
  for (const { mesh, box } of bodies) {
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    const axis = wallNormalAxis(s);

    const sign = outwardSign(c[axis], wallBox.min[axis], wallBox.max[axis], opt.edgeTolerance);
    if (sign === null) continue; // 칸막이벽은 건드리지 않는다

    const outward = new THREE.Vector3();
    outward[axis] = sign;

    // glTF 머티리얼은 여러 벽이 공유한다. 벽마다 따로 투명해져야 하므로 복제한다(원본 주석).
    const original = Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material;
    const clone = original.clone() as FadeWall['material'];
    // 반투명해진 벽이 바닥과 겹치는 자리에서 반짝이는 것(z-fighting)을 막는다 —
    // 아래 update()의 side 전환과 함께 쓴다. 깊이 비교에서 이 면을 아주 살짝 앞으로 당겨
    // 같은 깊이에서 통과/탈락이 픽셀마다 뒤집히는 것을 없앤다.
    clone.polygonOffset = true;
    clone.polygonOffsetFactor = -1;
    clone.polygonOffsetUnits = -1;
    mesh.material = clone;

    walls.push({
      mesh,
      material: clone,
      original,
      originalSide: original.side,
      center: c,
      outward,
      name: mesh.parent?.name || mesh.name,
    });
  }

  // ── 3. 매 프레임 갱신 ──
  const v = new THREE.Vector3();

  function update(camera: THREE.Camera): void {
    for (const w of walls) {
      v.copy(w.center).sub(camera.position).normalize();
      const facing = -w.outward.dot(v);
      const m = w.material;

      if (opt.mode === 'opaque') {
        w.mesh.visible = true;
        m.transparent = false;
        m.opacity = 1;
        m.depthWrite = true;
        m.side = w.originalSide;
        continue;
      }
      if (opt.mode === 'cull') {
        w.mesh.visible = facing <= 0;
        m.transparent = false;
        m.opacity = 1;
        m.depthWrite = true;
        m.side = w.originalSide;
        continue;
      }
      const opacity = fadeOpacity(facing, opt.band, opt.keep);
      w.mesh.visible = opacity > 0.004;
      m.opacity = opacity;
      m.transparent = opacity < 0.999;
      m.depthWrite = opacity > 0.98; // 반투명일 땐 깊이 기록을 끈다
      // ★ 반투명일 때만 앞면만 그린다(2026-10-17, 바닥 접합부 반짝임 수정).
      // 이 모델의 벽은 전부 DoubleSide고 **벽 밑면(y=0)이 바닥 윗면(y=0)과 정확히 겹친다**.
      // 반투명 + 깊이쓰기 꺼짐 상태에서 양면으로 그리면 아래를 보는 밑면이 바닥과 같은 깊이에
      // 블렌딩돼, 픽셀마다 깊이 테스트가 뒤집히며 접합부가 반짝인다. 밑면은 법선이 아래를
      // 향하므로 FrontSide로 두면 잘려 나간다(불투명으로 돌아가면 원래 side로 복구).
      // 근본 해결은 모델에서 벽 밑면을 바닥면과 겹치지 않게 조금 내리거나 올리는 것이다.
      m.side = m.transparent ? THREE.FrontSide : w.originalSide;
    }
  }

  function dispose(): void {
    for (const w of walls) {
      w.original.side = w.originalSide; // 원본은 건드리지 않았지만 방어적으로 되돌린다
      w.material.dispose();
      w.mesh.material = w.original;
      w.mesh.visible = true;
    }
    walls.length = 0;
  }

  return {
    update,
    dispose,
    get count() {
      return walls.length;
    },
    setMode: (mode) => {
      opt.mode = mode;
    },
  };
}
