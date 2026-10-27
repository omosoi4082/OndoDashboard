// 유동 입자 애니메이션(scene/FlowParticles.tsx) 순수 로직 — 2026-10-26 온도 측 요청
// ("공기 입자가 급기구에서 들어와 배기구로 흘러가는 애니메이션", "입자 색을 온도 / 습도로").
// 기준은 온도 데이터(grid.flow·supply)와 자돈방 안내문(mock/응답형식_추가안내_v1.3.3.txt
// "화면 구현 참고")이다. 샘플 HTML(Datacenter_v3_1_M2_3D열유동_뷰어.html)은 참고만 한다
// (2026-10-27 사용자 "데이터를 바탕으로 만들어야지, html은 말 그대로 참고만").
//   - 출발: 급기구 사각형 안 천장 바로 아래에서만, 급기 풍량에 비례한 개수(처음에도 방은 비어 있다).
//   - 소멸: 배기구에 닿으면(판정 범위는 배기구 격자 한 칸 — atOutlet).
//   - 멈춤: 벽·바닥 점이 0이라 그 근처에서 멈춘 입자는 급기구로 되돌린다(판정 값은 샘플 HTML 참고).
//   - 유속·온도·습도는 격자 8점 삼선형 보간, 실제 속도의 1·3·10배, 칸막이(0.78 m)는 통과하지 못한다.
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

/**
 * 칸막이 판 두께 몫의 여유(m) — 모델 실측 판 두께 0.04에 입자 반지름 몫을 더했다.
 * 입자가 이 띠 안으로 들어오지 못하게 막고, 위에서 내려온 입자는 판 위에 올려놓는다.
 */
const PARTITION_BLOCK_M = 0.05;

/** (x, y)가 칸막이 판이 서 있는 자리(선분에서 margin 안)인지. */
export function overPartition(
  wall: PartitionWall | undefined,
  x: number,
  y: number,
  margin: number = PARTITION_BLOCK_M,
): boolean {
  if (wall === undefined) return false;
  for (const [[ax, ay], [bx, by]] of wall.segments) {
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2)) : 0;
    const dx = x - (ax + t * vx);
    const dy = y - (ay + t * vy);
    if (dx * dx + dy * dy < margin * margin) return true;
  }
  return false;
}

/**
 * 막힌 속도를 칸막이 면 성분과 "타고 오르는" 성분으로 나눈다.
 *
 * 왜: 유속 데이터에는 칸막이가 들어 있지 않다(연산 격자에 경계가 없다). 그래서 수평 이동만
 * 되돌리면 입자가 벽 앞에서 멈췄다가 그대로 직선으로 지나가는 것처럼 보인다(2026-10-28 사용자:
 * "벽을 넘으면 물결처럼 보여야 하는데 아니다"). 실제 공기는 칸막이를 만나면 면을 따라 흐르면서
 * 위로 솟아 넘어간다 — 벽에 부딪친 성분(법선)을 위쪽 속도로 돌려 그 모양을 만든다.
 *
 * @returns 벽면을 따라가는 수평 속도(tx, ty)와 위로 돌릴 속도(climb). 가까운 선분이 없으면 null.
 */
export function partitionDeflect(
  wall: PartitionWall | undefined,
  x: number,
  y: number,
  vx: number,
  vy: number,
): { tx: number; ty: number; climb: number } | null {
  if (wall === undefined) return null;
  let best: { d2: number; ux: number; uy: number } | null = null;
  for (const [[ax, ay], [bx, by]] of wall.segments) {
    const sx = bx - ax;
    const sy = by - ay;
    const len2 = sx * sx + sy * sy;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((x - ax) * sx + (y - ay) * sy) / len2));
    const dx = x - (ax + t * sx);
    const dy = y - (ay + t * sy);
    const d2 = dx * dx + dy * dy;
    if (best === null || d2 < best.d2) {
      const len = Math.sqrt(len2);
      best = { d2, ux: sx / len, uy: sy / len };
    }
  }
  if (best === null) return null;
  // 면 방향 성분(미끄러짐)과 면에 부딪친 성분(위로 돌릴 양).
  const along = vx * best.ux + vy * best.uy;
  const tx = along * best.ux;
  const ty = along * best.uy;
  const climb = Math.abs(vx * -best.uy + vy * best.ux);
  return { tx, ty, climb };
}

/**
 * (x0,y0)→(x1,y1) 이동이 칸막이 높이 아래에서 칸막이에 막히는지.
 *
 * 가로지르는 경우뿐 아니라 **판 두께 안으로 파고드는 경우도 막는다**(2026-10-27 사용자: 제어
 * 모드에서 "회색 벽에 입자가 나온다"). geometry의 선분은 모델이 그리는 판의 한쪽 면이고
 * (실측 PigRoom_W0: x 1.82~1.86, 선분은 x = 1.82) 판은 그 옆으로 4 cm 두께가 있다. 선분만
 * 보면 반대쪽에서 온 입자가 판 속 4 cm까지 들어와 멈춰 **판 안에 박혀 보였다**(60초 모의에서
 * 제어 모드 약 1,100개). 이미 띠 안에 있던 입자는 막지 않는다 — 막으면 영영 못 빠져나온다.
 */
export function blockedByPartition(
  wall: PartitionWall | undefined,
  x0: number, y0: number, x1: number, y1: number, z: number,
  margin: number = PARTITION_BLOCK_M,
): boolean {
  if (wall === undefined || z > wall.height) return false;
  for (const [[cx, cy], [dx, dy]] of wall.segments) {
    if (segmentsCross(x0, y0, x1, y1, cx, cy, dx, dy)) return true;
  }
  return overPartition(wall, x1, y1, margin) && !overPartition(wall, x0, y0, margin);
}



/**
 * 판 윗면에 올려놓을 때 띄우는 높이(m). 윗면 높이에 정확히 두면 점이 판에 반쯤 박혀 보여
 * "칸막이를 뚫고 지나간다"처럼 보인다(2026-10-27 사용자, 제어 모드에서 확인).
 */
const PARTITION_CLEAR_M = 0.02;

/**
 * 칸막이에 부딪친 수평 속도를 위쪽 속도로 돌리는 비율. 1이면 부딪친 만큼 그대로 위로 간다.
 * 2026-10-28 사용자 요청(벽을 타고 넘는 물결 모양)으로 넣었다.
 */
const PARTITION_CLIMB = 1;


export interface ParticleOptions {
  /** 동시에 떠 있을 수 있는 최대 입자 수 — 다 차면 빈 자리가 날 때까지 급기구 투입을 쉰다. */
  count: number;
  /** 꼬리에 기억할 위치 수(머리 포함). */
  trail: number;
  /** 급기 공기 1 m³당 입자 수(emitCountFor) — 최대 개수 ÷ 방 체적(방 공기 한 번 바뀔 만큼이면 다 찬다). */
  particlesPerM3: number;
  /** supply가 없을 때(viz 꺼짐) 쓰는 급기 풍량(m³/h). */
  fallbackAirflowM3h: number;
  /** 입자가 통과하지 못하는 칸막이. 없으면 막지 않는다. */
  partition?: PartitionWall;
  /** 입자 수명(화면 초) — 이 시간이 지나면 급기구에서 다시 내보낸다. 없으면 수명 없음. */
  maxAgeS?: number;
  /** 배기구 소멸 판정(기본 'cell'). 온도 측 안내문이 권한 방식은 'circle'이다. */
  outletHit?: OutletHit;
}

/**
 * 멈춤: |u|+|v|+|w| < STUCK_SPEED 상태가 STUCK_HOLD_S(실제 초) 이어지면 급기구로 되돌린다.
 * grid.flow는 벽·바닥 점이 0이라 그 근처로 간 입자는 속도가 0으로 줄어 그대로 멈춘다(바닥에
 * 쌓여 보였다). 값은 샘플 HTML을 참고했다.
 */
const STUCK_SPEED = 0.02;
const STUCK_HOLD_S = 25;
/** 한 단계에 이 거리(m)보다 멀리 가지 않게 쪼갠다(최대 16단계) — 배기구 앞 2.7 m/s도 건너뛰지 않게. */
const SUBSTEP_MAX_M = 0.04;
const SUBSTEP_MAX_N = 16;

export interface ParticleState {
  opts: ParticleOptions;
  /** 입자 자리 수(= count). */
  capacity: number;
  /** 위치 기록 — 입자 p의 k번째(0 = 현재) 위치가 (p*trail + k)*3 부터 x,y,z. */
  hist: Float32Array;
  /** 기록된 꼬리 길이(0~trail) — 0이면 비어 있는 자리(아직 안 나왔거나 배기구로 나감, 그리지 않는다). */
  histLen: Uint8Array;
  /** 놓인 뒤 화면 시간(초) — 서서히 나타나게 하는 데와 수명(maxAgeS) 판정에 쓴다. */
  age: Float32Array;
  /** 느린 상태가 이어진 실제 시간(초). */
  stuck: Float32Array;
  /** 아직 넣지 못한 소수점 이하 입자 수(다음 스텝으로 넘긴다). */
  emitCarry: number;
}

/** 방 안쪽으로 좌표를 자르는 여유(m). */
const WALL_MARGIN_M = 0.004;

/**
 * 배기구 벽(y = 0)에 닿은 입자가 벽을 따라 배기구 쪽으로 쓸려 가는 속도(m/s).
 *
 * 왜: 받은 유속은 배기구 격자점 한 점만 빨아들이고 둘레 벽 점은 0이라, 벽에 닿은 입자가
 * 배기구를 살짝 비껴가면 그 자리에 붙어 버린다. 실제로는 벽면을 따라 배기구로 모여 빠져나간다
 * (2026-10-28 사용자: "빠져나가는 입자는 모두 배기구를 통해서 나가게"). 온도 측 안내문도
 * 소멸은 geometry의 배기구 원을 쓰라고 했으므로, 원으로 모아 주는 쪽이 그 권고와 맞는다.
 */
const OUTLET_WALL_PULL_MS = 0.4;

function place(state: ParticleState, p: number, x: number, y: number, z: number): void {
  const o = p * state.opts.trail * 3;
  state.hist[o] = x;
  state.hist[o + 1] = y;
  state.hist[o + 2] = z;
  state.histLen[p] = 1;
  state.age[p] = 0;
  state.stuck[p] = 0;
}

/**
 * 급기구 사각형 안, 천장 바로 아래(면에서 급기 속도 × dt 안쪽까지 — 한꺼번에 나와 한 겹으로 겹치지 않게).
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

/** 빈 방으로 시작한다 — 입자는 stepParticles가 급기구에서 넣는다. */
export function createParticles(opts: ParticleOptions): ParticleState {
  const capacity = opts.count;
  return {
    opts,
    capacity,
    hist: new Float32Array(capacity * opts.trail * 3),
    histLen: new Uint8Array(capacity),
    age: new Float32Array(capacity),
    stuck: new Float32Array(capacity),
    emitCarry: 0,
  };
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
/**
 * 배기구 소멸 판정 방식.
 *  - 'circle' : geometry.json의 배기구 원(지름 0.4 m) 안 — 온도 측 안내문 "화면 구현 참고"가 권한 방식.
 *  - 'cell'   : 배기구 격자점이 걸친 격자 한 칸(x ±0.25, z ±0.4, 벽에서 0.25 m) — 원으로만 지우면
 *               입자가 원 바로 바깥 벽에 붙던 것을 넓혀 본 안이다(2026-10-27).
 */
export type OutletHit = 'circle' | 'cell';

export function atOutlet(
  geometry: Geometry,
  x: number,
  y: number,
  z: number,
  hit: OutletHit = 'cell',
): boolean {
  const out = geometry.room.outlet;
  if (out.wall !== 'y=0') return false;
  const { origin, spacing } = geometry.grid;
  if (hit === 'circle') {
    // 벽에서 한 칸 안쪽까지 들어온 입자가 배기구 원(지름 d) 안이면 빨려 나간 것으로 본다.
    const r = out.d / 2;
    const dx = x - out.x;
    const dz = z - out.z;
    return y <= origin[1] + spacing[1] && dx * dx + dz * dz <= r * r;
  }
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
 * dtS(화면 초)만큼 진행한다 — 실제 시간으로는 dtS × timeScale(1·3·10배).
 * 급기구 투입 → 이동 → 꼬리 기록 순서.
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
  const { trail, partition, particlesPerM3, fallbackAirflowM3h, maxAgeS, outletHit = 'cell' } = state.opts;
  const { capacity } = state;
  const fg = field.grid;
  const flow = field.flow;
  const [W, D, H] = geometry.room.size;
  const h = dtS * timeScale;
  if (h <= 0) return;

  // 급기구 투입 — 빈 자리가 있을 때만.
  const inlets = geometry.room.inlets;
  const outlet = geometry.room.outlet;
  const inletArea = inlets.reduce((a, it) => a + it.w * it.l, 0);
  const airflow = supply?.airflow_m3h ?? fallbackAirflowM3h;
  const inletVelocity = inletArea > 0 ? airflow / 3600 / inletArea : 0;
  if (inlets.length > 0) {
    const want = state.emitCarry + emitCountFor(supply, fallbackAirflowM3h, particlesPerM3, h);
    let n = Math.floor(want);
    state.emitCarry = want - n;
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
        // 벽면을 따라 미끄러지고, 벽에 부딪친 만큼은 위로 올라간다(칸막이를 타고 넘는 모양).
        const deflect = partitionDeflect(partition, x0, y0, vB[0], vB[1]);
        if (deflect === null) {
          x = x0;
          y = y0;
        } else {
          x = x0 + hs * deflect.tx;
          y = y0 + hs * deflect.ty;
          z = z0 + hs * (vB[2] + deflect.climb * PARTITION_CLIMB);
        }
      }
      // 판 자리로 내려오면 윗면에 올려놓는다 — 수평만 막으면 칸막이 바로 위에 떨어진 입자가
      // 판을 그대로 통과했다(2026-10-27 사용자 "입자가 뚫고 지나가는데"). 30초 모의에서 16개.
      // 위에서 판 자리로 내려오면 윗면 바로 위에 올려놓는다 — 수평만 막으면 칸막이 바로 위에
      // 떨어진 입자가 판을 그대로 통과했다(2026-10-27 사용자). 아래에서 옆으로 파고드는 경우는
      // 위 수평 차단이 이미 막으므로 여기서 들어 올리면 안 된다(들어 올리면 벽을 넘어가 버린다).
      if (
        partition !== undefined &&
        z0 >= partition.height &&
        z < partition.height + PARTITION_CLEAR_M &&
        overPartition(partition, x, y)
      ) {
        z = partition.height + PARTITION_CLEAR_M;
      }
      if (atOutlet(geometry, x, y, z, outletHit)) {
        exited = true;
        break;
      }
      x = Math.min(Math.max(x, WALL_MARGIN_M), W - WALL_MARGIN_M);
      y = Math.min(Math.max(y, WALL_MARGIN_M), D - WALL_MARGIN_M);
      z = Math.min(Math.max(z, WALL_MARGIN_M), H - WALL_MARGIN_M);
      // 배기구 벽에 닿았으면 벽을 따라 배기구로 모인다(위 OUTLET_WALL_PULL_MS 주석 참고).
      if (outlet.wall === 'y=0' && y <= WALL_MARGIN_M * 2) {
        const dx = outlet.x - x;
        const dz = outlet.z - z;
        const d = Math.hypot(dx, dz);
        if (d > 1e-6) {
          const stepM = Math.min(d, OUTLET_WALL_PULL_MS * hs);
          x += (dx / d) * stepM;
          z += (dz / d) * stepM;
        }
      }
    }
    if (exited) {
      // 배기구로 나감 → 빈 자리(다음 투입 때 급기구에서 다시 나온다).
      state.histLen[p] = 0;
      continue;
    }
    // 수명 — 오래된 입자는 급기구에서 다시 내보낸다(한자리에 겹쳐 쌓이지 않게).
    if (maxAgeS !== undefined && (state.age[p] ?? 0) > maxAgeS && inlets.length > 0) {
      placeAtInlet(state, p, geometry, inletVelocity, h, rand);
      continue;
    }
    // 멈춤 — 마지막 단계의 유속(|u|+|v|+|w|)으로 판정하고, 오래 멈추면 급기구로 되돌린다.
    const spd = Math.abs(vB[0]) + Math.abs(vB[1]) + Math.abs(vB[2]);
    if (spd < STUCK_SPEED) {
      state.stuck[p] = (state.stuck[p] ?? 0) + h;
      if ((state.stuck[p] ?? 0) > STUCK_HOLD_S && inlets.length > 0) {
        placeAtInlet(state, p, geometry, inletVelocity, h, rand);
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
