import { describe, expect, it } from 'vitest';
import { colormapRGB01 } from './colormap.js';
import { LEGEND_STEPS, legendGradientStops, legendTickTopPct } from './colorLegend.js';

function toCss(t: number, field: 'temp' | 'rh' | 'flow'): string {
  const [r, g, b] = colormapRGB01(t, field);
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

describe('legendGradientStops', () => {
  it('기본 정지점 개수는 LEGEND_STEPS이고 퍼센트는 오름차순(0%→100%)이다', () => {
    const stops = legendGradientStops('temp').split(', rgb').length;
    expect(stops).toBe(LEGEND_STEPS);
    const pcts = [...legendGradientStops('temp').matchAll(/\) ([\d.]+)%/g)].map((m) => Number(m[1]));
    expect(pcts[0]).toBe(0);
    expect(pcts[pcts.length - 1]).toBe(100);
    for (let i = 1; i < pcts.length; i++) expect(pcts[i]!).toBeGreaterThan(pcts[i - 1]!);
  });

  it('막대 위(0%)는 최댓값 색(t=1), 아래(100%)는 최솟값 색(t=0)이며 필드별 컬러맵을 따른다', () => {
    for (const field of ['temp', 'rh', 'flow'] as const) {
      const css = legendGradientStops(field, 5);
      expect(css.startsWith(`${toCss(1, field)} 0.0%`)).toBe(true);
      expect(css.endsWith(`${toCss(0, field)} 100.0%`)).toBe(true);
    }
  });
});

describe('legendTickTopPct', () => {
  it('max는 0%, min은 100%, 중간값은 50%', () => {
    expect(legendTickTopPct(30, 20, 30)).toBeCloseTo(0);
    expect(legendTickTopPct(20, 20, 30)).toBeCloseTo(100);
    expect(legendTickTopPct(25, 20, 30)).toBeCloseTo(50);
  });

  it('min==max여도 유한한 값을 돌려준다', () => {
    expect(Number.isFinite(legendTickTopPct(5, 5, 5))).toBe(true);
  });
});
