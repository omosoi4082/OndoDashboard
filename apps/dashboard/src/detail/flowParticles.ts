// 유동 입자 애니메이션(scene/FlowParticles.tsx) 순수 로직 — 2026-10-26 온도 측 요청
// ("공기 입자가 급기구에서 들어와 배기구로 흘러가는 애니메이션", "입자 색을 온도 / 습도로").
// 참고 샘플(Datacenter_v3_1_M2_3D열유동_뷰어.html)과 같은 방식: 입자 위치의 유속을 flowGrid에서
// 삼선형 보간해 중점법(RK2)으로 옮기고, 색은 같은 위치의 grid 온도·습도를 삼선형 보간한다.
// 좌표는 전부 데이터 좌표(z-up, m)다 — Three.js 변환은 그리는 쪽(zUpToYUp)에서 한다.
//
// flowGrid(0.5×0.5×0.7 m 간격)는 방 벽·천장까지 닿지 않는다(맨 위 노드 z = 2.45, 천장 2.8).
// 격자 바깥은 가장 가까운 가장자리 노드 값을 그대로 쓴다(보간 좌표를 격자 안으로 자른다).
// 칸막이(높이 0.78 m)는 flowGrid로 표현되지 않아 입자가 통과할 수 있다(05-open-questions.md).
import type { FlowVec, Geometry, GridDef } from '@ondo/shared';

export type Rand = () => number;

/** 삼선형 보간 공통부 — 좌표를 격자 칸 (i,j,k)와 칸 안 비율 (tx,ty,tz)로 바꾼다. */
function cellOf(grid: GridDef, x: number, y: number, z: number): {
  i: number; j: number; k: number; tx: number; ty: number; tz: number;
} {
  const [nx, ny, nz] = grid.size;
  const axis = (p: number, o: number, s: number, n: number): [number, number] => {
    if (n < 2) return [0, 0];
    let f = (p - o) / s;
    if (f < 0) f = 0;
    else if (f > n - 1) f = n - 1;
    const c = Math.min(Math.floor(f), n - 2);
    return [c, f - c];
  };
  const [i, tx] = axis(x, grid.origin[0], grid.spacing[0], nx);
  const [j, ty] = axis(y, grid.origin[1], grid.spacing[1], ny);
  const [k, tz] = axis(z, grid.origin[2], grid.spacing[2], nz);
  return { i, j, k, tx, ty, tz };
}

/** 8개 꼭짓점 인덱스·가중치 — 인덱스 공식은 i + nx*(j + ny*k)(docs/02-relay-api.md 5장). */
function corners(grid: GridDef, x: number, y: number, z: number): { idx: number[]; w: number[] } {
  const [nx, ny, nz] = grid.size;
  const { i, j, k, tx, ty, tz } = cellOf(grid, x, y, z);
  const i1 = Math.min(i + 1, nx - 1);
  const j1 = Math.min(j + 1, ny - 1);
  const k1 = Math.min(k + 1, nz - 1);
  const at = (a: number, b: number, c: number): number => a + nx * (b + ny * c);
  return {
    idx: [at(i, j, k), at(i1, j, k), at(i, j1, k), at(i1, j1, k), at(i, j, k1), at(i1, j, k1), at(i, j1, k1), at(i1, j1, k1)],
    w: [
      (1 - tx) * (1 - ty) * (1 - tz), tx * (1 - ty) * (1 - tz), (1 - tx) * ty * (1 - tz), tx * ty * (1 - tz),
      (1 - tx) * (1 - ty) * tz, tx * (1 - ty) * tz, (1 - tx) * ty * tz, tx * ty * tz,
    ],
  };
}

/** grid 스칼라(온도·습도) 삼선형 보간. 값이 비어 있으면 NaN. */
export function sampleScalar(grid: GridDef, values: readonly number[], x: number, y: number, z: number): number {
  const { idx, w } = corners(grid, x, y, z);
  let sum = 0;
  for (let n = 0; n < 8; n++) {
    const v = values[idx[n] ?? 0];
    if (v === undefined) return Number.NaN;
    sum += v * (w[n] ?? 0);
  }
  return sum;
}

/** flowGrid 유속 (vx,vy,vz) 삼선형 보간 — out에 써서 돌려준다(매 프레임 할당 방지). */
export function sampleVelocity(
  grid: GridDef,
  flow: readonly FlowVec[],
  x: number,
  y: number,
  z: number,
  out: [number, number, number],
): [number, number, number] {
  const { idx, w } = corners(grid, x, y, z);
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  for (let n = 0; n < 8; n++) {
    const f = flow[idx[n] ?? 0];
    const wn = w[n] ?? 0;
    if (!f) continue;
    out[0] += f[0] * wn;
    out[1] += f[1] * wn;
    out[2] += f[2] * wn;
  }
  return out;
}

export interface ParticleOptions {
  count: number;
  /** 꼬리에 기억할 위치 수(머리 포함). */
  trail: number;
  /** 다시 태어날 때 급기구에서 나올 확률 — 나머지는 방 안 아무 곳에서 나온다(샘플과 같음). */
  inletShare: number;
  /** 수명(초, 화면 시간) 범위 — 배기구에 못 간 입자도 이 시간이 지나면 다시 태어난다. */
  lifeMinS: number;
  lifeMaxS: number;
  /** 화면 1초에 흐르는 실제 시간(초) — 유속이 0.1 m/s 안팎이라 실제 속도로는 거의 안 보인다. */
  timeScale: number;
  /** 이 속도(m/s)보다 느린 상태가 stuckS초 이어지면 다시 태어난다(바닥·벽에 붙은 입자). */
  stuckSpeed: number;
  stuckS: number;
}

export interface ParticleState {
  opts: ParticleOptions;
  /** 위치 기록 — 입자 p의 k번째(0 = 현재) 위치가 (p*trail + k)*3 부터 x,y,z. */
  hist: Float32Array;
  /** 기록된 꼬리 길이(0~trail) — 막 태어난 입자는 꼬리가 없다. */
  histLen: Uint8Array;
  age: Float32Array;
  life: Float32Array;
  stuck: Float32Array;
}

/** 방 안쪽으로 좌표를 자르는 여유(m) — 벽에 정확히 붙으면 보간이 가장자리 값만 쓰게 된다. */
const WALL_MARGIN_M = 0.02;

function spawn(state: ParticleState, p: number, geometry: Geometry, rand: Rand, fromInlet: boolean): void {
  const { trail } = state.opts;
  const [W, D, H] = geometry.room.size;
  let x: number;
  let y: number;
  let z: number;
  const inlets = geometry.room.inlets;
  if (fromInlet && inlets.length > 0) {
    const inlet = inlets[Math.floor(rand() * inlets.length)] ?? inlets[0];
    // w는 데이터 x, l은 데이터 y 방향 길이(docs/04-tasks.md, p1.glb 실측 확인).
    x = (inlet?.x ?? W / 2) + (rand() - 0.5) * (inlet?.w ?? 0);
    y = (inlet?.y ?? D / 2) + (rand() - 0.5) * (inlet?.l ?? 0);
    z = (inlet?.z ?? H) - WALL_MARGIN_M - rand() * 0.05;
  } else {
    x = WALL_MARGIN_M + rand() * (W - 2 * WALL_MARGIN_M);
    y = WALL_MARGIN_M + rand() * (D - 2 * WALL_MARGIN_M);
    z = WALL_MARGIN_M + rand() * (H - 2 * WALL_MARGIN_M);
  }
  const o = p * trail * 3;
  state.hist[o] = x;
  state.hist[o + 1] = y;
  state.hist[o + 2] = z;
  state.histLen[p] = 1;
  state.age[p] = 0;
  state.stuck[p] = 0;
  const { lifeMinS, lifeMaxS } = state.opts;
  state.life[p] = lifeMinS + rand() * (lifeMaxS - lifeMinS);
}

export function createParticles(geometry: Geometry, opts: ParticleOptions, rand: Rand = Math.random): ParticleState {
  const state: ParticleState = {
    opts,
    hist: new Float32Array(opts.count * opts.trail * 3),
    histLen: new Uint8Array(opts.count),
    age: new Float32Array(opts.count),
    life: new Float32Array(opts.count),
    stuck: new Float32Array(opts.count),
  };
  // 처음엔 방 전체에 고르게 뿌리고, 나이를 흩어 한꺼번에 다시 태어나지 않게 한다.
  for (let p = 0; p < opts.count; p++) {
    spawn(state, p, geometry, rand, false);
    state.age[p] = rand() * (state.life[p] ?? 0);
  }
  return state;
}

/** 배기구(벽 y=0의 원, 지름 d)에 닿았는지 — 벽 쪽으로 손 한 뼘(0.1 m) 안이면 나간 것으로 본다. */
function atOutlet(geometry: Geometry, x: number, y: number, z: number): boolean {
  const out = geometry.room.outlet;
  if (out.wall !== 'y=0') return false;
  const r = out.d / 2 + 0.05;
  return y < 0.1 && (x - out.x) ** 2 + (z - out.z) ** 2 < r * r;
}

const vA: [number, number, number] = [0, 0, 0];
const vB: [number, number, number] = [0, 0, 0];

/** dtS(화면 초)만큼 입자를 옮긴다. 꼬리는 한 칸씩 밀고 맨 앞에 새 위치를 넣는다. */
export function stepParticles(
  state: ParticleState,
  geometry: Geometry,
  flow: readonly FlowVec[],
  dtS: number,
  rand: Rand = Math.random,
): void {
  const { count, trail, timeScale, inletShare, stuckSpeed, stuckS } = state.opts;
  const fg = geometry.flowGrid;
  const [W, D, H] = geometry.room.size;
  const h = dtS * timeScale;
  for (let p = 0; p < count; p++) {
    const age = (state.age[p] ?? 0) + dtS;
    state.age[p] = age;
    if (age > (state.life[p] ?? 0)) {
      spawn(state, p, geometry, rand, rand() < inletShare);
      continue;
    }
    const o = p * trail * 3;
    let x = state.hist[o] ?? 0;
    let y = state.hist[o + 1] ?? 0;
    let z = state.hist[o + 2] ?? 0;
    // 중점법(RK2) — 샘플과 같다.
    sampleVelocity(fg, flow, x, y, z, vA);
    sampleVelocity(fg, flow, x + 0.5 * h * vA[0], y + 0.5 * h * vA[1], z + 0.5 * h * vA[2], vB);
    x += h * vB[0];
    y += h * vB[1];
    z += h * vB[2];
    if (atOutlet(geometry, x, y, z)) {
      spawn(state, p, geometry, rand, rand() < inletShare);
      continue;
    }
    x = Math.min(Math.max(x, WALL_MARGIN_M), W - WALL_MARGIN_M);
    y = Math.min(Math.max(y, WALL_MARGIN_M), D - WALL_MARGIN_M);
    z = Math.min(Math.max(z, WALL_MARGIN_M), H - WALL_MARGIN_M);
    const speed = Math.hypot(vB[0], vB[1], vB[2]);
    // 벽·바닥에 막혀 제자리인 경우도 "느림"으로 친다(잘린 뒤 실제로 거의 안 움직임).
    const moved = Math.hypot(x - (state.hist[o] ?? 0), y - (state.hist[o + 1] ?? 0), z - (state.hist[o + 2] ?? 0));
    if (speed < stuckSpeed || moved < stuckSpeed * h * 0.5) {
      state.stuck[p] = (state.stuck[p] ?? 0) + dtS;
      if ((state.stuck[p] ?? 0) > stuckS) {
        spawn(state, p, geometry, rand, rand() < inletShare);
        continue;
      }
    } else {
      state.stuck[p] = 0;
    }
    state.hist.copyWithin(o + 3, o, o + (trail - 1) * 3);
    state.hist[o] = x;
    state.hist[o + 1] = y;
    state.hist[o + 2] = z;
    state.histLen[p] = Math.min((state.histLen[p] ?? 0) + 1, trail);
  }
}
