import { describe, expect, it } from 'vitest';
import { axisTicksWithEnd, niceAxisTicks } from './axisTicks.js';

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

describe('axisTicksWithEnd', () => {
  // 2026-10-13 온도 측 B-9: 방 폭 4.5 m인데 눈금이 4 m에서 끝나던 문제.
  it('방 폭 0~4.5m에서 끝 값 4.5를 포함한다', () => {
    expect(axisTicksWithEnd(0, 4.5)).toEqual([0, 1, 2, 3, 4, 4.5]);
  });

  it('끝 값이 이미 눈금에 있으면 중복해서 넣지 않는다(0~4.0m)', () => {
    expect(axisTicksWithEnd(0, 4)).toEqual([0, 1, 2, 3, 4]);
  });

  it('끝 값이 마지막 눈금과 너무 가까우면 그 눈금을 대체한다', () => {
    // 0~4.1: 간격 1, 마지막 눈금 4와 4.1의 거리 0.1 < 1*0.35 → 4를 4.1로 대체
    expect(axisTicksWithEnd(0, 4.1)).toEqual([0, 1, 2, 3, 4.1]);
  });

  it('유동 격자 범위(0.25~4.25)도 양끝이 드러난다', () => {
    const ticks = axisTicksWithEnd(0.25, 4.25);
    expect(ticks[ticks.length - 1]).toBe(4.25);
  });

  it('max <= min이면 끝 값 하나만 돌려준다', () => {
    expect(axisTicksWithEnd(2, 2)).toEqual([2]);
  });
});
