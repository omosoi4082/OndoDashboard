// docs/03-upstream-apis.md 4.3 "Mock": COMPUTE_MODE=mock일 때 MockComputeClient가 연산 서버
// 응답(4.2) 형식 그대로 생성한다(시드 고정 = 결정적, Math.random을 쓰지 않는다). 형상은
// GEOMETRY_FILE에서 읽은 Geometry 개수 그대로(하드코딩 금지). temp는 급기구→배기구 기울기와
// 입력 T_out을 반영하고, flow는 급기구→배기구(배기구로 수렴하는) 방향 벡터장이다.
import type { FlowVec, Geometry } from '@ondo/shared';
import type { ComputeFrame, ComputeRequestInput } from '../clients/computeClient.js';

const ROOM_DELTA_T = 6; // 배기구 쪽이 급기구 쪽보다 동물열로 더 더워진다고 가정(℃)
const RH_DELTA = 8; // %
const TEMP_NOISE_AMPLITUDE = 0.4;
const RH_NOISE_AMPLITUDE = 1.5;
const FLOW_MAX_MPS = 0.6;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** 결정적(시드 고정) -1~1 잡음 — 좌표마다 매끈하게 바뀌는 값. Math.random 미사용. */
function pseudoNoise(x: number, y: number, z: number): number {
  return (Math.sin(x * 12.9898 + y * 78.233) + Math.cos(y * 4.898 + z * 37.719) + Math.sin(z * 3.17 + x * 1.73)) / 3;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}
function normalize(a: Vec3): Vec3 {
  const len = length(a);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: a.x / len, y: a.y / len, z: a.z / len };
}

interface RoomAxis {
  supply: Vec3;
  exhaust: Vec3;
  axis: Vec3;
  axisLenSq: number;
}

/**
 * docs/02-relay-api.md "자돈방 형상" 기준 급기구(천장·안쪽 벽)→배기구(y=0 벽) 축.
 * 정확한 급기구 3개·배기구 1개 좌표 대신 Geometry.room.size로 일반화한 대표 좌표를 쓴다
 * (mock 전용 — 실제 치수는 Geometry 자체에 있고, 이 값은 색·흐름 기울기 방향 결정용).
 */
function roomAxis(geometry: Geometry): RoomAxis {
  const [sx, sy, sz] = geometry.room.size;
  const supply: Vec3 = { x: sx / 2, y: sy, z: sz };
  const exhaust: Vec3 = { x: sx / 2, y: 0, z: sz / 2 };
  const axis = sub(exhaust, supply);
  return { supply, exhaust, axis, axisLenSq: Math.max(dot(axis, axis), 1e-6) };
}

function progressAlongAxis(point: Vec3, ra: RoomAxis): number {
  const rel = sub(point, ra.supply);
  return clamp(dot(rel, ra.axis) / ra.axisLenSq, 0, 1);
}

function tempAt(point: Vec3, ra: RoomAxis, tOut: number): number {
  const progress = progressAlongAxis(point, ra);
  return tOut + ROOM_DELTA_T * progress + TEMP_NOISE_AMPLITUDE * pseudoNoise(point.x, point.y, point.z);
}

function rhAt(point: Vec3, ra: RoomAxis, rhOut: number): number {
  const progress = progressAlongAxis(point, ra);
  const v = rhOut + RH_DELTA * progress + RH_NOISE_AMPLITUDE * pseudoNoise(point.z, point.x, point.y);
  return clamp(v, 0, 100);
}

function flowAt(point: Vec3, ra: RoomAxis, fanPct: number): FlowVec {
  const dir = normalize(sub(ra.exhaust, point)); // 배기구로 수렴하는 방향
  const progress = progressAlongAxis(point, ra);
  const value = clamp((fanPct / 100) * FLOW_MAX_MPS * (0.4 + 0.6 * progress), 0, FLOW_MAX_MPS);
  return [dir.x * value, dir.y * value, dir.z * value, value];
}

function mean(values: readonly number[], fallback: number): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : fallback;
}

/** 연산 서버 응답(4.2) 1개 프레임을 결정적으로 생성한다. current는 이 프레임을 1개만 쓴다. */
export function generateMockFrame(input: ComputeRequestInput, geometry: Geometry): ComputeFrame {
  const ra = roomAxis(geometry);
  const [nx, ny, nz] = geometry.grid.size;
  const [fnx, fny, fnz] = geometry.flowGrid.size;

  const pointsTemp: number[] = [];
  const pointsRh: number[] = [];
  const pointsFlow: FlowVec[] = [];
  const midX = geometry.room.size[0] / 2;
  const westTemps: number[] = [];
  const eastTemps: number[] = [];

  for (const p of geometry.points) {
    const point: Vec3 = { x: p.x, y: p.y, z: p.z };
    const t = tempAt(point, ra, input.T_out);
    pointsTemp.push(t);
    pointsRh.push(rhAt(point, ra, input.RH_out));
    pointsFlow.push(flowAt(point, ra, input.fan_pct));
    if (p.x < midX) westTemps.push(t);
    else eastTemps.push(t);
  }

  const gridCount = nx * ny * nz;
  const gridTemp = new Array<number>(gridCount).fill(0);
  const gridRh = new Array<number>(gridCount).fill(0);
  for (let k = 0; k < nz; k += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const point: Vec3 = {
          x: geometry.grid.origin[0] + i * geometry.grid.spacing[0],
          y: geometry.grid.origin[1] + j * geometry.grid.spacing[1],
          z: geometry.grid.origin[2] + k * geometry.grid.spacing[2],
        };
        const idx = i + nx * (j + ny * k); // docs/02-relay-api.md 5장 격자 1차원 인덱스
        gridTemp[idx] = tempAt(point, ra, input.T_out);
        gridRh[idx] = rhAt(point, ra, input.RH_out);
      }
    }
  }

  // flow 배열도 같은 인덱스 규칙(i + nx*(j + ny*k))을 따른다. i가 가장 안쪽 루프이므로
  // push 순서가 그대로 그 인덱스 순서가 된다.
  const flow: FlowVec[] = [];
  for (let k = 0; k < fnz; k += 1) {
    for (let j = 0; j < fny; j += 1) {
      for (let i = 0; i < fnx; i += 1) {
        const point: Vec3 = {
          x: geometry.flowGrid.origin[0] + i * geometry.flowGrid.spacing[0],
          y: geometry.flowGrid.origin[1] + j * geometry.flowGrid.spacing[1],
          z: geometry.flowGrid.origin[2] + k * geometry.flowGrid.spacing[2],
        };
        flow.push(flowAt(point, ra, input.fan_pct));
      }
    }
  }

  const allTemp = [...pointsTemp, ...gridTemp];
  const allRh = [...pointsRh, ...gridRh];
  const allFlowValue = [...pointsFlow.map((f) => f[3]), ...flow.map((f) => f[3])];

  return {
    time: input.time,
    points: { temp: pointsTemp, rh: pointsRh, flow: pointsFlow },
    grid: { temp: gridTemp, rh: gridRh },
    flow,
    outdoor: { T_out: input.T_out, RH_out: input.RH_out, fan_pct: input.fan_pct },
    summary: {
      T_mean: mean(allTemp, input.T_out),
      T_min: allTemp.length > 0 ? Math.min(...allTemp) : input.T_out,
      T_max: allTemp.length > 0 ? Math.max(...allTemp) : input.T_out,
      T_west: mean(westTemps, input.T_out),
      T_east: mean(eastTemps, input.T_out),
      RH_mean: mean(allRh, input.RH_out),
      V_mean: mean(allFlowValue, 0),
      V_max: allFlowValue.length > 0 ? Math.max(...allFlowValue) : 0,
    },
    quality: { in_range: true, warnings: [] },
  };
}
