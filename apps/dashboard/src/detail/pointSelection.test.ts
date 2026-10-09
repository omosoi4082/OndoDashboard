import { describe, expect, it } from 'vitest';
import { getFieldRange, getFieldUnit, getPointFlow, getPointScalar } from './pointSelection.js';
import type { DetailBase, DetailFrame } from '@ondo/shared';

function fakeFrame(): DetailFrame {
  return {
    offsetMin: 0,
    time: '2026-10-09T12:00:00+09:00',
    points: {
      temp: [26, 27],
      rh: [55, 60],
      flow: [[1, 0, 0, 0.3]],
    },
    grid: { temp: [], rh: [] },
    flow: [],
    outdoor: { T_out: 24, RH_out: 50, fan_pct: 40 },
    summary: { T_mean: 26.5, T_min: 26, T_max: 27, T_west: 26, T_east: 27, RH_mean: 57.5, V_mean: 0.3, V_max: 0.3 },
    quality: { in_range: true, warnings: [] },
  };
}

const range: DetailBase['range'] = {
  temp: { min: 20, max: 30 },
  rh: { min: 40, max: 70 },
  flow: { min: 0, max: 1 },
};

describe('getPointScalar', () => {
  it('temp 필드는 points.temp에서 꺼낸다', () => {
    expect(getPointScalar(fakeFrame(), 'temp', 1)).toBe(27);
  });

  it('rh 필드는 points.rh에서 꺼낸다', () => {
    expect(getPointScalar(fakeFrame(), 'rh', 0)).toBe(55);
  });

  it('flow 필드는 유속 크기(flow[3])를 꺼낸다', () => {
    expect(getPointScalar(fakeFrame(), 'flow', 0)).toBe(0.3);
  });

  it('해당 포인트의 flow가 없으면 0', () => {
    expect(getPointScalar(fakeFrame(), 'flow', 1)).toBe(0);
  });
});

describe('getPointFlow', () => {
  it('포인트의 FlowVec을 그대로 돌려준다', () => {
    expect(getPointFlow(fakeFrame(), 0)).toEqual([1, 0, 0, 0.3]);
  });

  it('없으면 null', () => {
    expect(getPointFlow(fakeFrame(), 99)).toBeNull();
  });
});

describe('getFieldRange / getFieldUnit', () => {
  it('필드별 range를 꺼낸다', () => {
    expect(getFieldRange(range, 'temp')).toEqual(range.temp);
    expect(getFieldRange(range, 'rh')).toEqual(range.rh);
    expect(getFieldRange(range, 'flow')).toEqual(range.flow);
  });

  it('필드별 단위 문자열', () => {
    expect(getFieldUnit('temp')).toBe('℃');
    expect(getFieldUnit('rh')).toBe('%');
    expect(getFieldUnit('flow')).toBe('m/s');
  });
});
