import { describe, expect, it } from 'vitest';
import type { DetailFrame, FlowVec, Geometry, GridDef } from '@ondo/shared';
import {
  blockedByPartition,
  overPartition,
  createParticles,
  emitCountFor,
  atOutlet,
  sampleScalar,
  sampleVelocity,
  segmentsCross,
  stepParticles,
  velocityFieldOf,
  type ParticleOptions,
  type ParticleState,
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

// 내보내기 없음(particlesPerM3 0) — 입자는 테스트가 place로 직접 놓는다.
const OPTS: ParticleOptions = {
  count: 4,
  trail: 3,
  particlesPerM3: 0,
  fallbackAirflowM3h: 0,
};

const SUPPLY = { airflow_m3h: 3600, ach: 12, inlet_velocity: 0.26, T_supply: 25, RH_supply: 80, pad_on: true };

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

/** 입자 p를 (x, y, z)에 놓는다(막 나온 입자). */
function place(st: ParticleState, p: number, x: number, y: number, z: number): void {
  const o = p * st.opts.trail * 3;
  st.hist[o] = x;
  st.hist[o + 1] = y;
  st.hist[o + 2] = z;
  st.histLen[p] = 1;
  st.age[p] = 0;
  st.stuck[p] = 0;
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

describe('emitCountFor — 급기 풍량 비례', () => {
  it('들어온 공기 부피 × 1 m³당 입자 수', () => {
    // 3,600 m³/h = 1 m³/s, 2초 → 2 m³ × 5개
    expect(emitCountFor(SUPPLY, 0, 5, 2)).toBeCloseTo(10);
  });

  it('supply가 없으면 대체 풍량', () => {
    expect(emitCountFor(undefined, 1800, 5, 2)).toBeCloseTo(5);
  });
});

describe('atOutlet — 배기구 격자점이 걸친 격자 한 칸', () => {
  // 실제 형상: grid 간격 0.25×0.25×0.4, 배기구 중심 (2.25, 0, 1.6) → x 2.0~2.5, z 1.2~2.0, y 0.25 안.
  const REAL: Geometry = {
    ...GEOMETRY,
    room: { ...GEOMETRY.room, size: [4.5, 4, 2.8], outlet: { wall: 'y=0', x: 2.25, z: 1.6, d: 0.4 } },
    grid: { origin: [0, 0, 0], spacing: [0.25, 0.25, 0.4], size: [19, 17, 8] },
  };

  it('배기구 원 밖이라도 그 칸 안이면 나간다', () => {
    expect(atOutlet(REAL, 2.25, 0.02, 1.6)).toBe(true);
    expect(atOutlet(REAL, 2.45, 0.02, 1.25)).toBe(true); // 원(반지름 0.2) 밖, 칸 안
    expect(atOutlet(REAL, 2.25, 0.25, 1.6)).toBe(true);
  });

  it('칸 밖이면 아니다', () => {
    expect(atOutlet(REAL, 2.6, 0.02, 1.6)).toBe(false);
    expect(atOutlet(REAL, 2.25, 0.02, 1.1)).toBe(false);
    expect(atOutlet(REAL, 2.25, 0.3, 1.6)).toBe(false);
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

describe('stepParticles — 급기구 출발·배기구 소멸·멈춤 시 급기구로', () => {
  // 테스트 격자는 간격 1 m라 배기구 칸(atOutlet)이 방 전체를 덮는다 — 배기구 판정을 보는
  // 테스트 말고는 배기구를 y = 0이 아닌 벽으로 옮긴다.
  const NO_OUTLET: Geometry = { ...GEOMETRY, room: { ...GEOMETRY.room, outlet: { wall: 'x=0', x: 0, z: 0.5, d: 0.4 } } };
  const field = { grid: GRID, flow: new Array<FlowVec>(8).fill([0.1, 0, 0, 0.1]) };
  const still = { grid: GRID, flow: new Array<FlowVec>(8).fill([0, 0, 0, 0]) };

  /** 빈 상태(예비분만) — 입자는 place로 직접 놓는다. */
  function empty(opts: ParticleOptions): ParticleState {
    return createParticles(opts);
  }
  const alive = (st: ParticleState): number => Array.from(st.histLen).filter((n) => n > 0).length;

  it('처음엔 빈 방이다(방에 미리 뿌리지 않는다)', () => {
    const st = createParticles({ ...OPTS, count: 4 });
    expect(st.capacity).toBe(4);
    expect(alive(st)).toBe(0);
  });

  it('급기 풍량만큼 급기구 사각형 안 천장 바로 아래에 넣는다', () => {
    const st = empty({ ...OPTS, count: 4, particlesPerM3: 1 });
    // 1 m³/s × 3초 = 3개
    stepParticles(st, NO_OUTLET, still, SUPPLY, 3, 1, seq(0, 0.5, 0.5, 0));
    expect(alive(st)).toBe(3);
    for (let p = 0; p < 3; p++) {
      const o = p * 3 * 3;
      expect(st.hist[o]).toBeCloseTo(0.5); // 급기구 중심 x
      expect(st.hist[o + 1]).toBeCloseTo(0.5);
      expect(st.hist[o + 2]).toBeGreaterThan(0.9); // 천장(z = 1) 바로 아래
    }
  });

  it('배속만큼 실제 시간이 흘러 넣는 개수도 늘어난다', () => {
    const st = empty({ ...OPTS, count: 4, particlesPerM3: 1 });
    stepParticles(st, NO_OUTLET, still, SUPPLY, 1, 3, seq(0.5));
    expect(alive(st)).toBe(3);
  });

  it('빈 자리가 없으면 넣지 않는다(떠 있는 입자를 지우지 않는다)', () => {
    const st = createParticles({ ...OPTS, count: 2, particlesPerM3: 10 });
    place(st, 0, 0.2, 0.2, 0.5);
    place(st, 1, 0.3, 0.3, 0.5);
    stepParticles(st, NO_OUTLET, still, SUPPLY, 1, 1, seq(0.5));
    expect(alive(st)).toBe(2);
    expect(st.hist[0]).toBeCloseTo(0.2); // 떠 있던 입자는 그대로
  });

  it('유속 방향으로 옮기고 꼬리를 민다', () => {
    const st = empty({ ...OPTS, count: 1 });
    place(st, 0, 0.2, 0.5, 0.5);
    stepParticles(st, NO_OUTLET, field, undefined, 1, 1);
    expect(st.hist[0]).toBeCloseTo(0.3);
    expect(st.hist[3]).toBeCloseTo(0.2); // 꼬리 1칸 = 이전 위치
    expect(st.histLen[0]).toBe(2);
  });

  it('배율(timeScale)만큼 더 멀리 간다', () => {
    const st = empty({ ...OPTS, count: 1 });
    place(st, 0, 0.2, 0.5, 0.5);
    stepParticles(st, NO_OUTLET, field, undefined, 1, 3);
    expect(st.hist[0]).toBeCloseTo(0.5);
  });

  it('배기구 칸에 닿으면 사라진다(예비분으로)', () => {
    const toOutlet = { grid: GRID, flow: new Array<FlowVec>(8).fill([0, -1, 0, 1]) };
    const st = empty({ ...OPTS, count: 1 });
    place(st, 0, 0.5, 0.05, 0.5);
    stepParticles(st, GEOMETRY, toOutlet, undefined, 0.1, 1);
    expect(st.histLen[0]).toBe(0);
  });

  it('배기구가 아닌 벽에 닿으면 사라지지 않고 벽에 머문다', () => {
    const toWall = { grid: GRID, flow: new Array<FlowVec>(8).fill([0, -1, 0, 1]) };
    const st = empty({ ...OPTS, count: 1 });
    place(st, 0, 0.1, 0.05, 0.1);
    stepParticles(st, NO_OUTLET, toWall, undefined, 0.1, 1);
    expect(st.histLen[0]).toBe(2);
    expect(st.hist[1]).toBeCloseTo(0.004);
  });

  it('멈춤: 느린 상태가 25초(실제 시간) 넘게 이어지면 급기구로 되돌린다', () => {
    const st = empty({ ...OPTS, count: 1 });
    place(st, 0, 0.3, 0.3, 0.05);
    stepParticles(st, NO_OUTLET, still, undefined, 20, 1, seq(0.5));
    expect(st.hist[2]).toBeCloseTo(0.05); // 20초 — 아직 그대로
    stepParticles(st, NO_OUTLET, still, undefined, 10, 1, seq(0.5));
    expect(st.hist[0]).toBeCloseTo(0.5); // 급기구 중심
    expect(st.hist[2]).toBeGreaterThan(0.9); // 천장 바로 아래
    expect(st.stuck[0]).toBe(0);
  });

  it('멈춤: 빠르게 움직이면 멈춤 시간이 0으로 돌아간다', () => {
    const st = empty({ ...OPTS, count: 1 });
    place(st, 0, 0.2, 0.5, 0.5);
    st.stuck[0] = 20;
    stepParticles(st, NO_OUTLET, field, undefined, 0.1, 1);
    expect(st.stuck[0]).toBe(0);
  });

  it('칸막이 판 자리로는 위에서 아래로도 내려가지 못한다', () => {
    // 수평만 막으면 칸막이 바로 위에 떨어진 입자가 판을 그대로 통과했다(2026-10-27 사용자).
    const wall = { segments: [[[0.5, 0], [0.5, 1]]] as const, height: 0.78 };
    const st = empty({ ...OPTS, count: 1, partition: wall });
    place(st, 0, 0.5, 0.5, 0.9);
    const down = { grid: GRID, flow: new Array<FlowVec>(8).fill([0, 0, -1, 1]) };
    stepParticles(st, NO_OUTLET, down, undefined, 0.5, 1);
    expect(st.hist[2]).toBeCloseTo(0.78); // 판 윗면에 올라선다(Float32라 0.7799999)
  });

  it('overPartition: 판 선 위면 참, 멀면 거짓', () => {
    const wall = { segments: [[[0.5, 0], [0.5, 1]]] as const, height: 0.78 };
    expect(overPartition(wall, 0.5, 0.4)).toBe(true);
    expect(overPartition(wall, 0.51, 0.4)).toBe(true);
    expect(overPartition(wall, 0.6, 0.4)).toBe(false);
    expect(overPartition(wall, 0.5, 1.5)).toBe(false); // 선분 밖
    expect(overPartition(undefined, 0.5, 0.4)).toBe(false);
  });

  it('수명: maxAgeS가 지나면 급기구에서 다시 내보낸다', () => {
    // 유속이 성긴 목업(288점)에서 입자가 한자리에 겹쳐 쌓여 화면이 비어 보였다(2026-10-27).
    const st = empty({ ...OPTS, count: 1, maxAgeS: 5 });
    place(st, 0, 0.2, 0.5, 0.5);
    stepParticles(st, NO_OUTLET, field, undefined, 3, 1, seq(0.5));
    expect(st.hist[2]).toBeLessThan(0.9); // 아직 수명 안 지남
    stepParticles(st, NO_OUTLET, field, undefined, 3, 1, seq(0.5));
    expect(st.hist[0]).toBeCloseTo(0.5); // 급기구 중심
    expect(st.hist[2]).toBeGreaterThan(0.9); // 천장 바로 아래
    expect(st.age[0]).toBe(0);
  });

  it('칸막이 높이 아래에서는 칸막이를 넘지 못한다', () => {
    const wall = { segments: [[[0.5, 0], [0.5, 1]]] as const, height: 0.78 };
    const st = empty({ ...OPTS, count: 1, partition: wall });
    place(st, 0, 0.4, 0.5, 0.3);
    const fast = { grid: GRID, flow: new Array<FlowVec>(8).fill([1, 0, 0, 1]) };
    stepParticles(st, NO_OUTLET, fast, undefined, 0.5, 1);
    expect(st.hist[0]).toBeLessThan(0.5);
  });
});
