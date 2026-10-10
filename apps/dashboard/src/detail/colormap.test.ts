import { describe, expect, it } from 'vitest';
import { colormapRGB01, normalize, valueToRGB01, valueToRGB255 } from './colormap.js';

describe('colormapRGB01', () => {
  it('t=0이면 첫 색상 스탑', () => {
    expect(colormapRGB01(0)).toEqual([0.08, 0.2, 0.9]);
  });

  it('t=1이면 마지막 색상 스탑', () => {
    const [r, g, b] = colormapRGB01(1);
    expect(r).toBeCloseTo(0.95, 10);
    expect(g).toBeCloseTo(0.1, 10);
    expect(b).toBeCloseTo(0.1, 10);
  });

  it('범위를 벗어난 값은 0~1로 클램프된다', () => {
    expect(colormapRGB01(-5)).toEqual(colormapRGB01(0));
    expect(colormapRGB01(5)).toEqual(colormapRGB01(1));
  });

  it('스탑 사이 값은 선형 보간된다', () => {
    const [r] = colormapRGB01(0.15); // 0.0~0.3 구간의 중간
    expect(r).toBeCloseTo((0.08 + 0.0) / 2, 5);
  });
});

describe('normalize', () => {
  it('min~max를 0~1로 선형 변환한다', () => {
    expect(normalize(25, 20, 30)).toBeCloseTo(0.5, 5);
    expect(normalize(20, 20, 30)).toBe(0);
    expect(normalize(30, 20, 30)).toBe(1);
  });

  it('min===max(평탄한 응답)면 중간값 0.5', () => {
    expect(normalize(20, 20, 20)).toBe(0.5);
  });
});

describe('valueToRGB01 / valueToRGB255', () => {
  it('range 최솟값은 첫 색상 스탑과 같다', () => {
    expect(valueToRGB01(20, 20, 30)).toEqual(colormapRGB01(0));
  });

  it('255 스케일 변환은 0~255 정수다', () => {
    const [r, g, b] = valueToRGB255(25, 20, 30);
    for (const c of [r, g, b]) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(255);
      expect(Number.isInteger(c)).toBe(true);
    }
  });
});
