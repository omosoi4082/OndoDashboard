import { describe, expect, it } from 'vitest';
import { metersPerPixel, pickScaleBar } from './scaleBar.js';

describe('metersPerPixel', () => {
  it('거리가 멀어지면 1px당 거리(m)가 커진다', () => {
    const near = metersPerPixel(10, 45, 1000);
    const far = metersPerPixel(100, 45, 1000);
    expect(far).toBeGreaterThan(near);
  });

  it('공식대로 계산된다', () => {
    const result = metersPerPixel(10, 90, 1000);
    const expected = (2 * 10 * Math.tan(Math.PI / 4)) / 1000;
    expect(result).toBeCloseTo(expected);
  });
});

describe('pickScaleBar', () => {
  it('targetPx에 가장 가까운 눈금을 고른다', () => {
    const { meters, px } = pickScaleBar(0.01, 120); // 1px = 1cm → 120px = 1.2m에 가까운 값
    expect(meters).toBe(1);
    expect(px).toBeCloseTo(100);
  });

  it('줌 아웃(1px당 거리가 커짐)하면 더 큰 눈금을 고른다', () => {
    const zoomedIn = pickScaleBar(0.01, 120);
    const zoomedOut = pickScaleBar(0.5, 120);
    expect(zoomedOut.meters).toBeGreaterThan(zoomedIn.meters);
  });
});
