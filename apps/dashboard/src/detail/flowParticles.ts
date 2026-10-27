// 유동 입자 애니메이션(scene/FlowParticles.tsx) 순수 로직 — 2026-10-26 온도 측 요청
// ("공기 입자가 급기구에서 들어와 배기구로 흘러가는 애니메이션", "입자 색을 온도 / 습도로").
// 참고 샘플(Datacenter_v3_1_M2_3D열유동_뷰어.html)과 같은 방식: 입자 위치의 유속을 flowGrid에서
// 삼선형 보간해 중점법(RK2)으로 옮기고, 색은 같은 위치의 grid 온도·습도를 삼선형 보간한다.
// 좌표는 전부 데이터 좌표(z-up, m)다 — Three.js 변환은 그리는 쪽(zUpToYUp)에서 한다.
//
// 유속장은 둘 중 하나다(velocityFieldOf):
//   - grid.flow(연산 서버 v1.3.3 `viz: true`, 2026-10-27) — 온도·습도와 같은 2,584점, 천장·벽 포함,
//     급기구(w ≈ −0.5)·배기구(v ≈ −2.7) 경계조건이 들어 있다. 있으면 이것을 쓴다(온도 측 요청).
//   - flowGrid(288점, 0.5×0.5×0.7 m) — viz가 꺼졌거나 구버전 서버. 방 벽·천장까지 닿지 않아
//     (맨 위 노드 z = 2.45) 격자 바깥은 가장 가까운 가장자리 노드 값을 쓴다.
// 칸막이(높이 0.78 m)는 어느 격자로도 표현되지 않아(격자 간격보다 얇다) 선분 교차로 직접 막는다.
import type { DetailFrame, DetailFrameSupply, FlowVec, Geometry, GridDef } from '@ondo/shared';

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

/** 입자를 옮길 유속장 — 격자 정의와 그 격자 순서의 유속 배열. */
export interface VelocityField {
  grid: GridDef;
  flow: readonly FlowVec[];
}

function nodeCount(grid: GridDef): number {
  return grid.size[0] * grid.size[1] * grid.size[2];
}

/**
 * grid.flow가 있고 개수가 grid와 맞으면 그것을, 아니면 flowGrid(288점)를 쓴다.
 * 온도 측 요청(2026-10-27): "grid.flow가 있으면 그것을 쓰고 없으면 기존 288점" — 그래서
 * 연산 서버 요청에 viz만 켜면 화면 수정 없이 정밀 유속으로 바뀐다.
 */
export function velocityFieldOf(geometry: Geometry, frame: DetailFrame): VelocityField {
  const fine = frame.grid.flow;
  if (fine !== undefined && fine.length === nodeCount(geometry.grid)) {
    return { grid: geometry.grid, flow: fine };
  }
  return { grid: geometry.flowGrid, flow: frame.flow };
}

/**
 * 다시 태어날 때 급기구에서 나올 비율 — 급기 풍량에 비례시킨다(온도 측 안내: "출발 개수는
 * supply.airflow_m3h에 비례시키면 들어오는 공기량이 맞습니다"). 입자 총수는 고정이라 개수 대신
 * 비율을 바꾼다. supply가 없으면(viz 꺼짐) 기본 비율 그대로.
 */
export function inletShareFor(base: number, supply: DetailFrameSupply | undefined, refAirflowM3h: number): number {
  if (supply === undefined || refAirflowM3h <= 0) return base;
  return base * Math.min(Math.max(supply.airflow_m3h / refAirflowM3h, 0), 1);
}

/** 칸막이 — 바닥에서 height(m)까지 선 모양 벽. segments는 room 좌표 (x, y) 선분. */
export interface PartitionWall {
  segments: ReadonlyArray<readonly [readonly [number, number], readonly [number, number]]>;
  height: number;
}

/** 2D 선분 (a→b)와 (c→d)가 서로 가로지르는지(끝점이 닿기만 하는 경우 포함). */
export function segmentsCross(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const cross = (px: number, py: number, qx: number, qy: number, rx: number, ry: number): number =>
    (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = cross(cx, cy, dx, dy, ax, ay);
  const d2 = cross(cx, cy, dx, dy, bx, by);
  const d3 = cross(ax, ay, bx, by, cx, cy);
  const d4 = cross(ax, ay, bx, by, dx, dy);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0) || d1 === 0 || d2 === 0) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0) || d3 === 0 || d4 === 0) &&
    !(d1 === 0 && d2 === 0); // 같은 직선 위(벽을 따라 미끄러짐)는 가로지른 것이 아니다
}

/** (x0,y0)→(x1,y1) 이동이 칸막이 높이 아래에서 칸막이를 가로지르는지. */
export function blockedByPartition(
  wall: PartitionWall | undefined,
  x0: number, y0: number, x1: number, y1: number, z: number,
): boolean {
  if (wall === undefined || z > wall.height) return false;
  for (const [[cx, cy], [dx, dy]] of wall.segments) {
    if (segmentsCross(x0, y0, x1, y1, cx, cy, dx, dy)) return true;
  }
  return false;
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
  /** 입자가 통과하지 못하는 칸막이. 없으면 막지 않는다. */
  partition?: PartitionWall;
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

/**
 * dtS(화면 초)만큼 입자를 옮긴다. 꼬리는 한 칸씩 밀고 맨 앞에 새 위치를 넣는다.
 * inletShare를 주면 opts.inletShare 대신 쓴다(급기 풍량 비례 — inletShareFor).
 */
export function stepParticles(
  state: ParticleState,
  geometry: Geometry,
  field: VelocityField,
  dtS: number,
  rand: Rand = Math.random,
  inletShareOverride?: number,
): void {
  const { count, trail, timeScale, stuckSpeed, stuckS, partition } = state.opts;
  const inletShare = inletShareOverride ?? state.opts.inletShare;
  const fg = field.grid;
  const flow = field.flow;
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
    const x0 = x;
    const y0 = y;
    x += h * vB[0];
    y += h * vB[1];
    z += h * vB[2];
    // 칸막이에 막히면 수평 이동만 버린다(위아래로는 계속 흘러 칸막이를 넘어갈 수 있다).
    if (blockedByPartition(partition, x0, y0, x, y, Math.min(z, state.hist[o + 2] ?? z))) {
      x = x0;
      y = y0;
    }
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
