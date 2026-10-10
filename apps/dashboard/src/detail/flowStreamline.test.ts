import { describe, expect, it } from 'vitest';
import type { FlowVec, GridDef, RoomInlet } from '@ondo/shared';
import { allInletSeeds, inletSeeds, sampleFlowVelocity, traceStreamline } from './flowStreamline.js';

describe('sampleFlowVelocity', () => {
  // 단위 정육면체(2×2×2=8 노드). x방향으로만 값이 달라지게 둬서 보간 확인.
  const grid: GridDef = { origin: [0, 0, 0], spacing: [1, 1, 1], size: [2, 2, 2] };
  const flow: FlowVec[] = Array.from({ length: 8 }, (_, idx) => {
    const i = idx % 2;
    return i === 1 ? [1, 0, 0, 20] : [1, 0, 0, 10];
  });

  it('격자점과 정확히 일치하면 그 값을 그대로 돌려준다', () => {
    expect(sampleFlowVelocity(grid, flow, [1, 0, 0])).toEqual([1, 0, 0, 20]);
  });

  it('두 격자점 사이는 거리 비례로 보간한다', () => {
    expect(sampleFlowVelocity(grid, flow, [0.5, 0, 0])).toEqual([1, 0, 0, 15]);
  });

  it('격자 범위를 벗어난 점은 가장 가까운 경계로 clamp해서 보간한다(상수 외삽)', () => {
    expect(sampleFlowVelocity(grid, flow, [5, 0, 0])).toEqual([1, 0, 0, 20]);
    expect(sampleFlowVelocity(grid, flow, [-5, 0, 0])).toEqual([1, 0, 0, 10]);
  });
});

describe('traceStreamline', () => {
  // 크기 1(노드 1개)인 격자 — 어디를 쿼리하든 그 값 하나만 돌려줘서 "균일한 유동장"을 흉내낸다.
  const uniformDownGrid: GridDef = { origin: [0, 0, 0], spacing: [1, 1, 1], size: [1, 1, 1] };

  it('균일한 유동장을 따라 걸음 수만큼 전진한 경로를 쌓는다', () => {
    const flow: FlowVec[] = [[0, 0, -1, 5]];
    const path = traceStreamline(uniformDownGrid, flow, [5, 5, 9], [10, 10, 10], {
      stepLength: 1,
      maxSteps: 5,
      minSpeed: 0.1,
      seedsPerInlet: 6,
    });
    expect(path).toHaveLength(6);
    expect(path.map((p) => p[2])).toEqual([9, 8, 7, 6, 5, 4]);
    expect(path.every((p) => p[0] === 5 && p[1] === 5)).toBe(true);
  });

  it('속도가 minSpeed보다 느리면 시작점만 돌려준다', () => {
    const flow: FlowVec[] = [[0, 0, 0, 0]];
    const path = traceStreamline(uniformDownGrid, flow, [5, 5, 5], [10, 10, 10]);
    expect(path).toEqual([[5, 5, 5]]);
  });

  it('다음 걸음이 room 범위를 벗어나면 그 전까지만 쌓고 멈춘다', () => {
    const flow: FlowVec[] = [[0, 0, 1, 5]];
    const path = traceStreamline(uniformDownGrid, flow, [5, 5, 1.5], [10, 10, 2], {
      stepLength: 1,
      maxSteps: 5,
      minSpeed: 0.1,
      seedsPerInlet: 6,
    });
    expect(path).toEqual([[5, 5, 1.5]]);
  });
});

describe('inletSeeds / allInletSeeds', () => {
  const inlet: RoomInlet = { x: 2.25, y: 0.83, z: 2.8, w: 0.32, l: 0.687 };

  it('seedsPerInlet개 시드를 급기구 중심 둘레에 흩뿌린다', () => {
    const seeds = inletSeeds(inlet, 6);
    expect(seeds).toHaveLength(6);
    // 전부 z는 급기구 높이 그대로, x/y는 중심에서 80% 범위 안쪽으로 퍼짐.
    for (const [x, y, z] of seeds) {
      expect(z).toBe(2.8);
      expect(Math.abs(x - inlet.x)).toBeLessThanOrEqual((inlet.w / 2) * 0.8 + 1e-9);
      expect(Math.abs(y - inlet.y)).toBeLessThanOrEqual((inlet.l / 2) * 0.8 + 1e-9);
    }
  });

  it('seedsPerInlet=1이면 중심점 하나만 돌려준다', () => {
    expect(inletSeeds(inlet, 1)).toEqual([[2.25, 0.83, 2.8]]);
  });

  it('allInletSeeds는 급기구 여러 개의 시드를 전부 합친다', () => {
    const seeds = allInletSeeds([inlet, inlet], 3);
    expect(seeds).toHaveLength(6);
  });
});
