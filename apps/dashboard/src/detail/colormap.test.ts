import { describe, expect, it } from 'vitest';
import { colormapRGB01, normalize, valueToRGB01, valueToRGB255 } from './colormap.js';

// 색상 자체(RGB 값)는 colormap.ts의 SATURATION_BOOST 하나로 튜닝하는 값이라(사용자가 직접
// 조정) 여기서 정확한 색을 하드코딩하지 않는다 — 보간·클램프 등 알고리즘만 검증한다.
describe('colormapRGB01', () => {
  it('0~1 범위 안에서는 항상 유효한 RGB(0~1) 값을 돌려준다', () => {
    for (const t of [0, 0.15, 0.3, 0.55, 0.75, 1]) {
      for (const c of colormapRGB01(t)) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });

  it('t=0과 t=1은 고정된(결정적인) 색이고 서로 다르다', () => {
    expect(colormapRGB01(0)).toEqual(colormapRGB01(0));
    expect(colormapRGB01(1)).toEqual(colormapRGB01(1));
    expect(colormapRGB01(0)).not.toEqual(colormapRGB01(1));
  });

  it('범위를 벗어난 값은 0~1로 클램프된다', () => {
    expect(colormapRGB01(-5)).toEqual(colormapRGB01(0));
    expect(colormapRGB01(5)).toEqual(colormapRGB01(1));
  });

  it('스탑 사이 값은 선형 보간된다', () => {
    const c0 = colormapRGB01(0);
    const c03 = colormapRGB01(0.3);
    const mid = colormapRGB01(0.15); // 0.0~0.3 구간의 중간
    for (let i = 0; i < 3; i++) {
      expect(mid[i]).toBeCloseTo((c0[i] + c03[i]) / 2, 5);
    }
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
