// 값→색상 매핑(온도·습도·유동 범례 공통) —
// technical-review/pig-farm-cfd-demo/src/colormap.js 포팅(docs/07-starter-kit-assets.md)에서
// 출발했으나, 지금은 필드(온도/습도/유동)별로 최솟값·최댓값 색만 hex로 지정하고 중간은
// 자동으로 이어주는 2점 그라데이션 방식이다(2026-10-10 사용자 요청: "값 색지정에 27282C
// 이런식으로 표기할 수 있게, 중간은 알아서, 온/습/유동 별도로").
import type { ValueField } from '../store/detailStore.js';

export type RGB01 = readonly [number, number, number];

export interface FieldColorRange {
  /** 최솟값 색(hex, '#' 없이 6자리 RRGGBB — 예: "27282C") */
  low: string;
  /** 최댓값 색(hex) */
  high: string;
}

// 필드별 색 범위 — 여기 hex 두 개만 바꾸면 된다(채도는 아래 SATURATION_BOOST로 전부에
// 일괄 적용). rh·flow는 당장 온도와 같은 배색으로 시작하되 독립적으로 바꿀 수 있다.
export const FIELD_COLOR_RANGES: Record<ValueField, FieldColorRange> = {
  temp: { low: '304DD9', high: 'E63326' },
  rh: { low: '304DD9', high: 'E63326' },
  flow: { low: '304DD9', high: 'E63326' },
};

// 1.0 = 원본 채도 그대로, 2.0 = 채도 2배(흰색 섞인 비율을 절반으로). 1보다 작으면 더 연하게.
const SATURATION_BOOST = 1.8;

function hexToRgb01(hex: string): RGB01 {
  const clean = hex.replace(/^#/, '');
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function rgbToHsl([r, g, b]: RGB01): readonly [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hue2rgb(p: number, q: number, tInput: number): number {
  let t = tInput;
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): RGB01 {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

function boostSaturation(rgb: RGB01, factor: number): RGB01 {
  const [h, s, l] = rgbToHsl(rgb);
  return hslToRgb(h, Math.min(1, s * factor), l);
}

function stopsForField(field: ValueField): ReadonlyArray<readonly [number, RGB01]> {
  const { low, high } = FIELD_COLOR_RANGES[field];
  return [
    [0, boostSaturation(hexToRgb01(low), SATURATION_BOOST)],
    [1, boostSaturation(hexToRgb01(high), SATURATION_BOOST)],
  ];
}

/** 0~1로 정규화된 값을 RGB(0~1)로 변환한다. field 기본값은 온도. */
export function colormapRGB01(tInput: number, field: ValueField = 'temp'): RGB01 {
  const stops = stopsForField(field);
  const t = Math.min(Math.max(tInput, 0), 1);
  for (let i = 0; i < stops.length - 1; i++) {
    const stop0 = stops[i];
    const stop1 = stops[i + 1];
    if (!stop0 || !stop1) continue;
    const [t0, c0] = stop0;
    const [t1, c1] = stop1;
    if (t >= t0 && t <= t1) {
      const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  const last = stops[stops.length - 1];
  return last ? last[1] : [0, 0, 0];
}

/**
 * 응답의 range(min/max, 01-functional-spec.md 3장 "색상 범위는 응답의 range 기준")로
 * 값을 0~1로 정규화한다. min===max(평탄한 응답)면 중간값 0.5로 고정한다.
 */
export function normalize(value: number, min: number, max: number): number {
  const span = max - min;
  if (span <= 0) return 0.5;
  return (value - min) / span;
}

export function valueToRGB01(value: number, min: number, max: number, field: ValueField = 'temp'): RGB01 {
  return colormapRGB01(normalize(value, min, max), field);
}

export function valueToRGB255(
  value: number,
  min: number,
  max: number,
  field: ValueField = 'temp',
): readonly [number, number, number] {
  const [r, g, b] = valueToRGB01(value, min, max, field);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
