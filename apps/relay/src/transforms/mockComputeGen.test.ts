import { describe, expect, it } from 'vitest';
import type { Geometry } from '@ondo/shared';
import { generateMockFrame } from './mockComputeGen.js';
import type { ComputeRequestInput } from '../clients/computeClient.js';

const SMALL_GEOMETRY: Geometry = {
  geometryId: 'test-geometry',
  room: { size: [4, 4, 2] },
  points: [
    { id: 0, x: 0.5, y: 0.5, z: 0.5 },
    { id: 1, x: 3.5, y: 3.5, z: 1.5 },
    { id: 2, x: 2, y: 2, z: 1 },
  ],
  grid: { origin: [0, 0, 0], spacing: [1, 1, 1], size: [3, 3, 2] }, // 18개
  flowGrid: { origin: [0.5, 0.5, 0.5], spacing: [2, 2, 1], size: [2, 2, 2] }, // 8개
};

const INPUT: ComputeRequestInput = { time: '2026-10-05T15:20:00', T_out: 21.5, RH_out: 65, fan_pct: 60 };

describe('generateMockFrame', () => {
  it('배열 개수는 geometry에서 읽은 값과 같다(하드코딩 없음)', () => {
    const frame = generateMockFrame(INPUT, SMALL_GEOMETRY);
    expect(frame.points.temp).toHaveLength(SMALL_GEOMETRY.points.length);
    expect(frame.points.rh).toHaveLength(SMALL_GEOMETRY.points.length);
    expect(frame.points.flow).toHaveLength(SMALL_GEOMETRY.points.length);
    expect(frame.grid.temp).toHaveLength(18);
    expect(frame.grid.rh).toHaveLength(18);
    expect(frame.flow).toHaveLength(8);
  });

  it('결정적이다(시드 고정) — 같은 입력이면 항상 같은 출력', () => {
    const a = generateMockFrame(INPUT, SMALL_GEOMETRY);
    const b = generateMockFrame(INPUT, SMALL_GEOMETRY);
    expect(a).toEqual(b);
  });

  it('outdoor 필드는 입력을 그대로 반영한다', () => {
    const frame = generateMockFrame(INPUT, SMALL_GEOMETRY);
    expect(frame.outdoor).toEqual({ T_out: 21.5, RH_out: 65, fan_pct: 60 });
  });

  it('temp는 T_out 근처에서 기울기를 가진다(T_min이 T_out 근방, T_max가 더 높음)', () => {
    const frame = generateMockFrame(INPUT, SMALL_GEOMETRY);
    expect(frame.summary.T_min).toBeGreaterThan(INPUT.T_out - 2);
    expect(frame.summary.T_max).toBeGreaterThan(frame.summary.T_min);
  });

  it('summary 최소·평균·최대 순서가 일관된다', () => {
    const frame = generateMockFrame(INPUT, SMALL_GEOMETRY);
    expect(frame.summary.T_min).toBeLessThanOrEqual(frame.summary.T_mean);
    expect(frame.summary.T_mean).toBeLessThanOrEqual(frame.summary.T_max);
    expect(frame.summary.V_mean).toBeLessThanOrEqual(frame.summary.V_max);
  });

  it('fan_pct가 0이면 유동 크기도 0에 가깝다', () => {
    const frame = generateMockFrame({ ...INPUT, fan_pct: 0 }, SMALL_GEOMETRY);
    expect(frame.summary.V_max).toBe(0);
  });

  it('quality는 mock 기준 항상 정상', () => {
    const frame = generateMockFrame(INPUT, SMALL_GEOMETRY);
    expect(frame.quality).toEqual({ in_range: true, warnings: [] });
  });
});
