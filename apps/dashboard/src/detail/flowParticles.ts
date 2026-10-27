// 유동 입자 애니메이션(scene/FlowParticles.tsx) 순수 로직 — 2026-10-26 온도 측 요청
// ("공기 입자가 급기구에서 들어와 배기구로 흘러가는 애니메이션", "입자 색을 온도 / 습도로").
// 규칙은 온도 측 샘플 방식 그대로다(mock/응답형식_추가안내_v1.3.3.txt "화면 구현 참고",
// 2026-10-27 사용자 "샘플과 똑같이"): 급기구 사각형 안 천장 바로 아래에서 출발, y = 0 벽의
// 배기구에 닿으면 소멸(판정 범위는 원이 아니라 배기구 격자 한 칸 — atOutlet), 출발 개수는 급기 풍량 비례, 실제 속도의 1·3·10배, 위치의
// 유속·온도·습도는 격자 8점 삼선형 보간, 칸막이(0.78 m)는 통과하지 못한다.
// 안내문에 없는 세부(처음 방에 고르게 뿌리기, 예비분 0.5배, 멈춘 입자 다시 놓기, 단계 쪼개기)는
// 샘플 코드(Datacenter_v3_1_M2_3D열유동_뷰어.html)의 값을 그대로 옮겼다(2026-10-27 사용자).
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

/**
 * 삼선형 보간 꼭짓점 8개의 인덱스·가중치를 모듈 버퍼(CI·CW)에 쓴다 — 입자가 프레임마다 수만 번
 * 부르므로 객체·배열을 새로 만들지 않는다(만들면 10배속에서 프레임당 70 ms를 넘었다).
 * 격자 밖 좌표는 가장자리로 자른다. 인덱스 공식은 i + nx*(j + ny*k)(docs/02-relay-api.md 5장).
 */
const CI = new Int32Array(8);
const CW = new Float64Array(8);

function axisCell(p: number, o: number, s: number, n: number): number {
  if (n < 2) return 0;
  let f = (p - o) / s;
  if (f < 0) f = 0;
  else if (f > n - 1) f = n - 1;
  return f;
}

function corners(grid: GridDef, x: number, y: number, z: number): void {
  const nx = grid.size[0];
  const ny = grid.size[1];
  const nz = grid.size[2];
  const fx = axisCell(x, grid.origin[0], grid.spacing[0], nx);
  const fy = axisCell(y, grid.origin[1], grid.spacing[1], ny);
  const fz = axisCell(z, grid.origin[2], grid.spacing[2], nz);
  const i = nx < 2 ? 0 : Math.min(Math.floor(fx), nx - 2);
  const j = ny < 2 ? 0 : Math.min(Math.floor(fy), ny - 2);
  const k = nz < 2 ? 0 : Math.min(Math.floor(fz), nz - 2);
  const tx = fx - i;
  const ty = fy - j;
  const tz = fz - k;
  const i1 = Math.min(i + 1, nx - 1);
  const j1 = Math.min(j + 1, ny - 1);
  const k1 = Math.min(k + 1, nz - 1);
  const r00 = nx * (j + ny * k);
  const r10 = nx * (j1 + ny * k);
  const r01 = nx * (j + ny * k1);
  const r11 = nx * (j1 + ny * k1);
  CI[0] = i + r00;
  CI[1] = i1 + r00;
  CI[2] = i + r10;
  CI[3] = i1 + r10;
  CI[4] = i + r01;
  CI[5] = i1 + r01;
  CI[6] = i + r11;
  CI[7] = i1 + r11;
  const ux = 1 - tx;
  const uy = 1 - ty;
  const uz = 1 - tz;
  CW[0] = ux * uy * uz;
  CW[1] = tx * uy * uz;
  CW[2] = ux * ty * uz;
  CW[3] = tx * ty * uz;
  CW[4] = ux * uy * tz;
  CW[5] = tx * uy * tz;
  CW[6] = ux * ty * tz;
  CW[7] = tx * ty * tz;
}

/** grid 스칼라(온도·습도) 삼선형 보간. 값이 비어 있으면 NaN. */
export function sampleScalar(grid: GridDef, values: readonly number[], x: number, y: number, z: number): number {
  corners(grid, x, y, z);
  let sum = 0;
  for (let n = 0; n < 8; n++) {
    const v = values[CI[n] ?? 0];
    if (v === undefined) return Number.NaN;
    sum += v * (CW[n] ?? 0);
  }
  return sum;
}

/** 유속 (vx,vy,vz) 삼선형 보간 — out에 써서 돌려준다(매 프레임 할당 방지). */
export function sampleVelocity(
  grid: GridDef,
  flow: readonly FlowVec[],
  x: number,
  y: number,
  z: number,
  out: [number, number, number],
): [number, number, number] {
  corners(grid, x, y, z);
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  for (let n = 0; n < 8; n++) {
    const f = flow[CI[n] ?? 0];
    const wn = CW[n] ?? 0;
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
 * 화면 1초 동안 급기구에서 나올 입자 수 — 급기 풍량에 비례한다(온도 측 안내: "출발 개수는
 * supply.airflow_m3h에 비례시키면 들어오는 공기량이 맞습니다"). 실제로 들어온 공기 부피
 * (풍량 × 실제 경과 시간)에 particlesPerM3를 곱한다. supply가 없으면(viz 꺼짐) fallbackM3h.
 */
export function emitCountFor(
  supply: DetailFrameSupply | undefined,
  fallbackM3h: number,
  particlesPerM3: number,
  realSeconds: number,
): number {
  const m3h = supply?.airflow_m3h ?? fallbackM3h;
  return Math.max(m3h, 0) / 3600 * realSeconds * particlesPerM3;
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
  /** 처음 방에 고르게 뿌리는 입자 수(샘플 NP). 자리는 1.5배를 잡고 나머지는 급기구 투입 예비분. */
  count: number;
  /** 꼬리에 기억할 위치 수(머리 포함). */
  trail: number;
  /** 급기 공기 1 m³당 입자 수(emitCountFor) — 샘플은 NP ÷ 방 체적. */
  particlesPerM3: number;
  /** supply가 없을 때(viz 꺼짐) 쓰는 급기 풍량(m³/h). */
  fallbackAirflowM3h: number;
  /** 입자가 통과하지 못하는 칸막이. 없으면 막지 않는다. */
  partition?: PartitionWall;
}

/**
 * 샘플(Datacenter_v3_1_M2_3D열유동_뷰어.html `seedAll`·`inject`·`advect`)과 같은 값.
 * 멈춤: 시작 STUCK_AFTER_S 뒤부터 |u|+|v|+|w| < STUCK_SPEED 상태가 STUCK_HOLD_S 이어지면
 * 방 안 아무 곳으로 다시 놓는다(바닥·벽에 멈춘 입자 정리). 시간은 전부 실제(시뮬레이션) 초.
 */
const STUCK_AFTER_S = 40;
const STUCK_SPEED = 0.02;
const STUCK_HOLD_S = 25;
/** 한 단계에 이 거리(m)보다 멀리 가지 않게 쪼갠다(샘플 0.04 m, 최대 16단계). */
const SUBSTEP_MAX_M = 0.04;
const SUBSTEP_MAX_N = 16;
/** 입자 자리 = count × 이 배수(샘플 NMAX = NP × 1.5). */
const CAPACITY_FACTOR = 1.5;

export interface ParticleState {
  opts: ParticleOptions;
  /** 입자 자리 수(= ceil(count × 1.5)). */
  capacity: number;
  /** 위치 기록 — 입자 p의 k번째(0 = 현재) 위치가 (p*trail + k)*3 부터 x,y,z. */
  hist: Float32Array;
  /** 기록된 꼬리 길이(0~trail) — 0이면 비어 있는 자리(배기구로 나갔거나 예비분, 그리지 않는다). */
  histLen: Uint8Array;
  /** 놓인 뒤 화면 시간(초) — 서서히 나타나게 하는 데만 쓴다. */
  age: Float32Array;
  /** 느린 상태가 이어진 실제 시간(초). */
  stuck: Float32Array;
  /** 시작부터 흐른 실제 시간(초) — 멈춤 규칙은 STUCK_AFTER_S 뒤부터. */
  simS: number;
  /** 아직 넣지 못한 소수점 이하 입자 수(다음 스텝으로 넘긴다). */
  emitCarry: number;
}

/** 방 안쪽으로 좌표를 자르는 여유(m) — 샘플 0.004. */
const WALL_MARGIN_M = 0.004;

function place(state: ParticleState, p: number, x: number, y: number, z: number): void {
  const o = p * state.opts.trail * 3;
  state.hist[o] = x;
  state.hist[o + 1] = y;
  state.hist[o + 2] = z;
  state.histLen[p] = 1;
  state.age[p] = 0;
  state.stuck[p] = 0;
}

/** 방 안 아무 곳(샘플 placeUniform — 벽에서 0.02 m 안쪽). */
function placeUniform(state: ParticleState, p: number, geometry: Geometry, rand: Rand): void {
  const [W, D, H] = geometry.room.size;
  place(state, p, 0.02 + rand() * (W - 0.04), 0.02 + rand() * (D - 0.04), 0.02 + rand() * (H - 0.04));
}

/**
 * 급기구 사각형 안, 천장 바로 아래(샘플 inject — 면에서 급기 속도 × dt 안쪽까지, 가장자리 3 % 안쪽).
 * 급기구 면적이 같아 셋 중 고르게 고른다.
 */
function placeAtInlet(state: ParticleState, p: number, geometry: Geometry, inletVelocity: number, h: number, rand: Rand): void {
  const [W, D, H] = geometry.room.size;
  const inlet = geometry.room.inlets[Math.floor(rand() * geometry.room.inlets.length)];
  // w는 데이터 x, l은 데이터 y 방향 길이(docs/04-tasks.md, p1.glb 실측 확인).
  const x = (inlet?.x ?? W / 2) + (rand() * 2 - 1) * ((inlet?.w ?? 0) / 2) * 0.97;
  const y = (inlet?.y ?? D / 2) + (rand() * 2 - 1) * ((inlet?.l ?? 0) / 2) * 0.97;
  const z = (inlet?.z ?? H) - 0.005 - rand() * Math.max(0.01, inletVelocity * h);
  place(state, p, x, y, z);
}

/** 처음엔 count개를 방 전체에 고르게 뿌리고(샘플 seedAll), 남은 0.5배는 예비분으로 비워 둔다. */
export function createParticles(geometry: Geometry, opts: ParticleOptions, rand: Rand = Math.random): ParticleState {
  const capacity = Math.ceil(opts.count * CAPACITY_FACTOR);
  const state: ParticleState = {
    opts,
    capacity,
    hist: new Float32Array(capacity * opts.trail * 3),
    histLen: new Uint8Array(capacity),
    age: new Float32Array(capacity),
    stuck: new Float32Array(capacity),
    simS: 0,
    emitCarry: 0,
  };
  for (let p = 0; p < opts.count; p++) placeUniform(state, p, geometry, rand);
  return state;
}

/**
 * 배기구로 빠져나갔는지 — 배기구 원(지름 d)이 아니라 **배기구 격자점이 걸친 격자 한 칸**에
 * 들어오면 나간 것으로 본다(2026-10-27 사용자 결정, 온도 측 확인 요청 중).
 *
 * 왜: grid.flow에서 배기구는 2,584점 중 한 점(v ≈ −2.7)이고 둘레 벽 점은 0이다. 보간하면
 * 그 한 칸 안에서 공기가 빨려 들고 원(반지름 0.2 m) 밖에서는 벽 쪽 속도가 0으로 줄어,
 * 원으로만 판정하면 입자 대부분이 원 바로 바깥 벽에 붙어 멈췄다(실제 응답 1분 모의:
 * 벽에 붙은 1,287개 중 99 %가 배기구 중심 0.5 m 안). 화면에 그리는 배기구 크기는 그대로다.
 * 칸 크기는 grid 간격에서 나온다 — 지금 형상이면 x 2.0~2.5, z 1.2~2.0, 벽에서 y 0.25 m 안.
 */
export function atOutlet(geometry: Geometry, x: number, y: number, z: number): boolean {
  const out = geometry.room.outlet;
  if (out.wall !== 'y=0') return false;
  const { origin, spacing } = geometry.grid;
  // 배기구 중심에 가장 가까운 격자점 — 그 점에서 앞뒤로 한 칸.
  const nodeX = origin[0] + Math.round((out.x - origin[0]) / spacing[0]) * spacing[0];
  const nodeZ = origin[2] + Math.round((out.z - origin[2]) / spacing[2]) * spacing[2];
  return (
    y <= origin[1] + spacing[1] &&
    Math.abs(x - nodeX) <= spacing[0] &&
    Math.abs(z - nodeZ) <= spacing[2]
  );
}

const vA: [number, number, number] = [0, 0, 0];
const vB: [number, number, number] = [0, 0, 0];

function maxSpeed(flow: readonly FlowVec[]): number {
  let m = 0;
  for (const f of flow) {
    const v = Math.hypot(f[0], f[1], f[2]);
    if (v > m) m = v;
  }
  return m;
}
const maxSpeedCache = new WeakMap<readonly FlowVec[], number>();

/**
 * dtS(화면 초)만큼 진행한다 — 실제 시간으로는 dtS × timeScale(샘플 1·3·10배).
 * 샘플 advance 순서 그대로: 급기구 투입(inject) → 이동(advect) → 꼬리 기록(pushHistory).
 */
export function stepParticles(
  state: ParticleState,
  geometry: Geometry,
  field: VelocityField,
  supply: DetailFrameSupply | undefined,
  dtS: number,
  timeScale: number,
  rand: Rand = Math.random,
): void {
  const { trail, partition, particlesPerM3, fallbackAirflowM3h } = state.opts;
  const { capacity } = state;
  const fg = field.grid;
  const flow = field.flow;
  const [W, D, H] = geometry.room.size;
  const h = dtS * timeScale;
  if (h <= 0) return;
  state.simS += h;

  // inject — 예비분이 있을 때만(샘플: freeList가 비면 넣지 않는다).
  const inlets = geometry.room.inlets;
  if (inlets.length > 0) {
    const want = state.emitCarry + emitCountFor(supply, fallbackAirflowM3h, particlesPerM3, h);
    let n = Math.floor(want);
    state.emitCarry = want - n;
    const inletArea = inlets.reduce((a, it) => a + it.w * it.l, 0);
    const airflow = supply?.airflow_m3h ?? fallbackAirflowM3h;
    const inletVelocity = inletArea > 0 ? airflow / 3600 / inletArea : 0;
    for (let p = 0; p < capacity && n > 0; p++) {
      if ((state.histLen[p] ?? 0) !== 0) continue;
      placeAtInlet(state, p, geometry, inletVelocity, h, rand);
      n--;
    }
  }

  // advect — 중점법(RK2), 한 단계 이동이 SUBSTEP_MAX_M을 넘지 않게 쪼갠다.
  let vmax = maxSpeedCache.get(flow);
  if (vmax === undefined) {
    vmax = maxSpeed(flow);
    maxSpeedCache.set(flow, vmax);
  }
  const nsub = Math.min(SUBSTEP_MAX_N, Math.max(1, Math.ceil((h * vmax) / SUBSTEP_MAX_M)));
  const hs = h / nsub;
  for (let p = 0; p < capacity; p++) {
    if ((state.histLen[p] ?? 0) === 0) continue;
    state.age[p] = (state.age[p] ?? 0) + dtS;
    const o = p * trail * 3;
    let x = state.hist[o] ?? 0;
    let y = state.hist[o + 1] ?? 0;
    let z = state.hist[o + 2] ?? 0;
    let exited = false;
    for (let sub = 0; sub < nsub; sub++) {
      sampleVelocity(fg, flow, x, y, z, vA);
      sampleVelocity(fg, flow, x + 0.5 * hs * vA[0], y + 0.5 * hs * vA[1], z + 0.5 * hs * vA[2], vB);
      const x0 = x;
      const y0 = y;
      const z0 = z;
      x += hs * vB[0];
      y += hs * vB[1];
      z += hs * vB[2];
      // 칸막이에 막히면 수평 이동만 버린다(위아래로는 계속 흘러 칸막이를 넘어갈 수 있다).
      if (blockedByPartition(partition, x0, y0, x, y, Math.min(z, z0))) {
        x = x0;
        y = y0;
      }
      if (atOutlet(geometry, x, y, z)) {
        exited = true;
        break;
      }
      x = Math.min(Math.max(x, WALL_MARGIN_M), W - WALL_MARGIN_M);
      y = Math.min(Math.max(y, WALL_MARGIN_M), D - WALL_MARGIN_M);
      z = Math.min(Math.max(z, WALL_MARGIN_M), H - WALL_MARGIN_M);
    }
    if (exited) {
      // 배기구로 나감 → 급기구에서 다시 들어올 예비분(샘플과 같다).
      state.histLen[p] = 0;
      continue;
    }
    // 멈춤 — 샘플은 마지막 단계의 유속(|u|+|v|+|w|)으로 판정한다.
    const spd = Math.abs(vB[0]) + Math.abs(vB[1]) + Math.abs(vB[2]);
    if (state.simS > STUCK_AFTER_S && spd < STUCK_SPEED) {
      state.stuck[p] = (state.stuck[p] ?? 0) + h;
      if ((state.stuck[p] ?? 0) > STUCK_HOLD_S) {
        placeUniform(state, p, geometry, rand);
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
