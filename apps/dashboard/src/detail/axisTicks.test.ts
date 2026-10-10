import { describe, expect, it } from 'vitest';
import { niceAxisTicks } from './axisTicks.js';

describe('niceAxisTicks', () => {
  it('범위 안에서만 눈금을 고른다', () => {
    const ticks = niceAxisTicks(0, 4.5);
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(4.5);
    }
  });

  it('0~4.5 범위는 1 간격 눈금(0,1,2,3,4)을 고른다', () => {
    expect(niceAxisTicks(0, 4.5)).toEqual([0, 1, 2, 3, 4]);
  });

  it('min===max면 그 값 하나만 돌려준다', () => {
    expect(niceAxisTicks(2, 2)).toEqual([2]);
  });

  it('더 큰 범위는 더 큰 간격을 고른다', () => {
    const ticks = niceAxisTicks(0, 95);
    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks.length).toBeLessThanOrEqual(10);
  });
});
