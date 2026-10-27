import { describe, expect, it } from 'vitest';
import type { DetailFrame, FlowVec, Geometry, GridDef } from '@ondo/shared';
import {
  blockedByPartition,
  createParticles,
  inletShareFor,
  sampleScalar,
  sampleVelocity,
  segmentsCross,
  stepParticles,
  velocityFieldOf,
  type ParticleOptions,
} from './flowParticles.js';

// 2×2×2 격자(간격 1 m) — 꼭짓점 8개.
const GRID: GridDef = { origin: [0, 0, 0], spacing: [1, 1, 1], size: [2, 2, 2] };
const COARSE: GridDef = { origin: [0.5, 0.5, 0.5], spacing: [1, 1, 1], size: [1, 1, 1] };

const GEOMETRY: Geometry = {
  geometryId: 'test',
  room: { size: [1, 1, 1], inlets: [{ x: 0.5, y: 0.5, z: 1, w: 0.2, l: 0.2 }], outlet: { wall: 'y=0', x: 0.5, z: 0.5, d: 0.4 } },
  points: [],
  grid: GRID,
  flowGrid: COARSE,
};

const OPTS: ParticleOptions = {
  count: 4,
  trail: 3,
  inletShare: 0,
  lifeMinS: 100,
  lifeMaxS: 100,
  timeScale: 1,
  stuckSpeed: 0,
  stuckS: 100,
};

function frame(gridFlow?: FlowVec[]): DetailFrame {
  return {
    offsetMin: 0,
    time: '2026-08-03T14:20:00+09:00',
    points: { temp: [], rh: [], flow: [] },
    grid: { temp: new Array(8).fill(20), rh: new Array(8).fill(70), ...(gridFlow ? { flow: gridFlow } : {}) },
    flow: [[0, 0, 0, 0]],
    outdoor: { T_out: 30, RH_out: 70, fan_pct: 100 },
    summary: { T_mean: 0, T_min: 0, T_max: 0, T_west: 0, T_east: 0, RH_mean: 0, V_mean: 0, V_max: 0 },
    quality: { in_range: true, warnings: [] },
  };
}

/** 고정 순서 난수 — 같은 입력이면 같은 결과. */
function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

describe('sampleScalar / sampleVelocity — 삼선형 보간', () => {
  const values = [0, 1, 2, 3, 4, 5, 6, 7]; // index = i + 2*(j + 2*k)

  it('꼭짓점에서는 그 노드 값과 같다', () => {
    expect(sampleScalar(GRID, values, 0, 0, 0)).toBe(0);
    expect(sampleScalar(GRID, values, 1, 0, 0)).toBe(1);
    expect(sampleScalar(GRID, values, 0, 1, 0)).toBe(2);
    expect(sampleScalar(GRID, values, 1, 1, 1)).toBe(7);
  });

  it('가운데는 8점 평균', () => {
    expect(sampleScalar(GRID, values, 0.5, 0.5, 0.5)).toBeCloseTo(3.5);
  });

  it('격자 밖은 가장자리 값으로 자른다', () => {
    expect(sampleScalar(GRID, values, -5, -5, -5)).toBe(0);
    expect(sampleScalar(GRID, values, 9, 9, 9)).toBe(7);
  });

  it('유속도 같은 규칙(성분별)', () => {
    const flow: FlowVec[] = values.map((v) => [v, -v, 2 * v, 0]);
    const out: [number, number, number] = [0, 0, 0];
    sampleVelocity(GRID, flow, 1, 1, 1, out);
    expect(out).toEqual([7, -7, 14]);
  });
});

describe('velocityFieldOf — grid.flow가 있으면 그것, 없으면 flowGrid', () => {
  it('grid.flow 개수가 grid와 맞으면 grid.flow', () => {
    const fine: FlowVec[] = new Array(8).fill([0, -1, 0, 1]);
    const field = velocityFieldOf(GEOMETRY, frame(fine));
    expect(field.grid).toBe(GRID);
    expect(field.flow).toBe(fine);
  });

  it('grid.flow가 없으면 flowGrid + frame.flow', () => {
    const f = frame();
    const field = velocityFieldOf(GEOMETRY, f);
    expect(field.grid).toBe(COARSE);
    expect(field.flow).toBe(f.flow);
  });

  it('grid.flow 개수가 틀리면 쓰지 않는다', () => {
    expect(velocityFieldOf(GEOMETRY, frame([[0, 0, 0, 0]])).grid).toBe(COARSE);
  });
});

describe('inletShareFor — 급기 풍량 비례', () => {
  const supply = { airflow_m3h: 620, ach: 12, inlet_velocity: 0.26, T_supply: 25, RH_supply: 80, pad_on: true };

  it('supply가 없으면 기본 비율', () => {
    expect(inletShareFor(0.5, undefined, 1240)).toBe(0.5);
  });

  it('기준 풍량의 절반이면 비율도 절반', () => {
    expect(inletShareFor(0.5, supply, 1240)).toBeCloseTo(0.25);
  });

  it('기준보다 크면 기본 비율에서 자른다', () => {
    expect(inletShareFor(0.5, { ...supply, airflow_m3h: 5000 }, 1240)).toBe(0.5);
  });
});

describe('칸막이 — 선분 교차', () => {
  const wall = { segments: [[[1, 0], [1, 2]]] as const, height: 0.78 };

  it('칸막이를 가로지르면 교차', () => {
    expect(segmentsCross(0.5, 1, 1.5, 1, 1, 0, 1, 2)).toBe(true);
  });

  it('칸막이와 나란히 움직이면 교차가 아니다', () => {
    expect(segmentsCross(0.5, 0, 0.5, 2, 1, 0, 1, 2)).toBe(false);
    expect(segmentsCross(1, 0.5, 1, 1.5, 1, 0, 1, 2)).toBe(false);
  });

  it('칸막이 끝을 지나서는 막지 않는다', () => {
    expect(segmentsCross(0.5, 3, 1.5, 3, 1, 0, 1, 2)).toBe(false);
  });

  it('칸막이 높이보다 위에서는 막지 않는다', () => {
    expect(blockedByPartition(wall, 0.5, 1, 1.5, 1, 0.5)).toBe(true);
    expect(blockedByPartition(wall, 0.5, 1, 1.5, 1, 1.0)).toBe(false);
    expect(blockedByPartition(undefined, 0.5, 1, 1.5, 1, 0.5)).toBe(false);
  });
});

describe('stepParticles', () => {
  const field = { grid: GRID, flow: new Array<FlowVec>(8).fill([0.1, 0, 0, 0.1]) };

  it('유속 방향으로 옮기고 꼬리를 민다', () => {
    const st = createParticles(GEOMETRY, { ...OPTS, count: 1 }, seq(0.2, 0.5, 0.5, 0));
    const x0 = st.hist[0] ?? 0;
    stepParticles(st, GEOMETRY, field, 1, seq(0.5));
    expect(st.hist[0]).toBeCloseTo(x0 + 0.1);
    expect(st.hist[3]).toBeCloseTo(x0); // 꼬리 1칸 = 이전 위치
    expect(st.histLen[0]).toBe(2);
  });

  it('배기구(y = 0 벽 원)에 닿으면 다시 태어난다', () => {
    const toOutlet = { grid: GRID, flow: new Array<FlowVec>(8).fill([0, -1, 0, 1]) };
    const st = createParticles(GEOMETRY, { ...OPTS, count: 1 }, seq(0.5, 0.05, 0.5, 0));
    stepParticles(st, GEOMETRY, toOutlet, 0.1, seq(0.5));
    expect(st.histLen[0]).toBe(1);
    expect(st.age[0]).toBe(0);
  });

  it('수명이 지나면 다시 태어난다(inletShare 1 → 급기구 아래)', () => {
    const st = createParticles(GEOMETRY, { ...OPTS, count: 1, lifeMinS: 1, lifeMaxS: 1 }, seq(0.5, 0.5, 0.5, 0));
    stepParticles(st, GEOMETRY, field, 2, seq(0), 1);
    expect(st.age[0]).toBe(0);
    expect(st.hist[2]).toBeGreaterThan(0.9); // 천장(z = 1) 바로 아래
  });

  it('칸막이 높이 아래에서는 칸막이를 넘지 못한다', () => {
    const wall = { segments: [[[0.5, 0], [0.5, 1]]] as const, height: 0.78 };
    const st = createParticles(GEOMETRY, { ...OPTS, count: 1, partition: wall }, seq(0.4, 0.5, 0.3, 0));
    const x0 = st.hist[0] ?? 0;
    expect(x0).toBeLessThan(0.5);
    const fast = { grid: GRID, flow: new Array<FlowVec>(8).fill([1, 0, 0, 1]) };
    stepParticles(st, GEOMETRY, fast, 0.5, seq(0.5));
    expect(st.hist[0]).toBeCloseTo(x0);
  });
});
