// 유동 흐름선(스트림라인) 추적 — flowGrid 속도장을 삼선형 보간하며 급기구에서 출발해
// 작은 걸음으로 전진, 경로(점들의 연속)를 쌓는다(05-open-questions.md #40). 렌더링 쪽
// (scene/FlowStreamlines.tsx)은 이 경로를 실린더로 이어붙이기만 한다 — 순수 함수로 분리해
// 단위 테스트한다(flowStreamline.test.ts). 좌표는 전부 데이터 좌표계(z-up, zUpToYUp 적용 전).
import type { FlowVec, Geometry, GridDef, RoomInlet } from '@ondo/shared';
import { flowNodeIndex } from './flowNodes.js';

export type Vec3 = readonly [number, number, number];

export interface StreamlineOptions {
  /** 한 걸음 길이(m). */
  stepLength: number;
  maxSteps: number;
  /** 이보다 느리면(거의 정체) 추적을 멈춘다(m/s). */
  minSpeed: number;
  /** 급기구 하나당 시작점 개수 — 참고 자료(Plotly streamtube)와 같은 기본 6개. */
  seedsPerInlet: number;
}

export const DEFAULT_STREAMLINE_OPTIONS: StreamlineOptions = {
  stepLength: 0.1,
  maxSteps: 60,
  minSpeed: 0.02,
  seedsPerInlet: 6,
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/**
 * 급기구(w×l 직사각형) 안에 seedsPerInlet개 시작점을 격자로 흩뿌린다. 가장자리에 딱
 * 붙으면 보간이 불안정할 수 있어 80%만 쓴다(중앙 쏠림). rows×cols는 seedsPerInlet에
 * 가장 가까운 정사각형에 가깝게 자동으로 고른다.
 */
export function inletSeeds(inlet: RoomInlet, seedsPerInlet: number): Vec3[] {
  if (seedsPerInlet <= 1) return [[inlet.x, inlet.y, inlet.z]];

  const rows = Math.max(1, Math.round(Math.sqrt(seedsPerInlet)));
  const cols = Math.max(1, Math.ceil(seedsPerInlet / rows));
  const inset = 0.8;

  const seeds: Vec3[] = [];
  for (let r = 0; r < rows && seeds.length < seedsPerInlet; r += 1) {
    const ty = rows === 1 ? 0.5 : r / (rows - 1);
    const yOffset = (ty - 0.5) * inlet.l * inset;
    for (let c = 0; c < cols && seeds.length < seedsPerInlet; c += 1) {
      const tx = cols === 1 ? 0.5 : c / (cols - 1);
      const xOffset = (tx - 0.5) * inlet.w * inset;
      seeds.push([inlet.x + xOffset, inlet.y + yOffset, inlet.z]);
    }
  }
  return seeds;
}

/** geometry의 급기구 전부에서 inletSeeds를 모은다. */
export function allInletSeeds(inlets: readonly RoomInlet[], seedsPerInlet: number): Vec3[] {
  return inlets.flatMap((inlet) => inletSeeds(inlet, seedsPerInlet));
}

/**
 * flowGrid 속도장을 point에서 삼선형 보간한다. point가 격자 범위를 벗어나면 가장 가까운
 * 경계로 clamp해서 보간한다(상수 외삽) — 급기구는 천장(z=2.8)에 있는데 flowGrid z 최대
 * 노드는 그보다 낮아서(원본 데이터 범위), 시작점이 격자 밖이어도 추적이 바로 안 끊기게
 * 하기 위함. "도메인을 벗어났다"는 판정은 room 크기 기준으로 traceStreamline에서 따로 한다.
 */
export function sampleFlowVelocity(flowGrid: GridDef, flow: readonly FlowVec[], point: Vec3): FlowVec {
  const [nx, ny, nz] = flowGrid.size;
  const [ox, oy, oz] = flowGrid.origin;
  const [sx, sy, sz] = flowGrid.spacing;

  const fx = clamp((point[0] - ox) / sx, 0, nx - 1);
  const fy = clamp((point[1] - oy) / sy, 0, ny - 1);
  const fz = clamp((point[2] - oz) / sz, 0, nz - 1);

  const i0 = Math.min(Math.floor(fx), nx - 2 < 0 ? 0 : nx - 2);
  const j0 = Math.min(Math.floor(fy), ny - 2 < 0 ? 0 : ny - 2);
  const k0 = Math.min(Math.floor(fz), nz - 2 < 0 ? 0 : nz - 2);
  const tx = nx > 1 ? fx - i0 : 0;
  const ty = ny > 1 ? fy - j0 : 0;
  const tz = nz > 1 ? fz - k0 : 0;

  const result: [number, number, number, number] = [0, 0, 0, 0];
  for (let di = 0; di <= (nx > 1 ? 1 : 0); di += 1) {
    for (let dj = 0; dj <= (ny > 1 ? 1 : 0); dj += 1) {
      for (let dk = 0; dk <= (nz > 1 ? 1 : 0); dk += 1) {
        const weight = (di ? tx : 1 - tx) * (dj ? ty : 1 - ty) * (dk ? tz : 1 - tz);
        if (weight === 0) continue;
        const idx = flowNodeIndex(flowGrid, i0 + di, j0 + dj, k0 + dk);
        const vec = flow[idx];
        if (!vec) continue;
        result[0] += vec[0] * weight;
        result[1] += vec[1] * weight;
        result[2] += vec[2] * weight;
        result[3] += vec[3] * weight;
      }
    }
  }
  return result;
}

/** seed에서 출발해 속도장을 따라 전진하며 경로를 쌓는다. 최소 [seed] 하나는 항상 돌려준다. */
export function traceStreamline(
  flowGrid: GridDef,
  flow: readonly FlowVec[],
  seed: Vec3,
  roomSize: Vec3,
  options: StreamlineOptions = DEFAULT_STREAMLINE_OPTIONS,
): Vec3[] {
  const points: Vec3[] = [seed];
  let pos = seed;

  for (let step = 0; step < options.maxSteps; step += 1) {
    const [vx, vy, vz] = sampleFlowVelocity(flowGrid, flow, pos);
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (speed < options.minSpeed) break;

    const next: Vec3 = [
      pos[0] + (vx / speed) * options.stepLength,
      pos[1] + (vy / speed) * options.stepLength,
      pos[2] + (vz / speed) * options.stepLength,
    ];
    if (
      next[0] < 0 ||
      next[0] > roomSize[0] ||
      next[1] < 0 ||
      next[1] > roomSize[1] ||
      next[2] < 0 ||
      next[2] > roomSize[2]
    ) {
      break;
    }
    points.push(next);
    pos = next;
  }
  return points;
}

/** geometry.room.inlets 전부에서 흐름선을 추적한다. */
export function traceAllStreamlines(
  geometry: Geometry,
  flow: readonly FlowVec[],
  options: StreamlineOptions = DEFAULT_STREAMLINE_OPTIONS,
): Vec3[][] {
  const seeds = allInletSeeds(geometry.room.inlets, options.seedsPerInlet);
  return seeds.map((seed) => traceStreamline(geometry.flowGrid, flow, seed, geometry.room.size, options));
}
