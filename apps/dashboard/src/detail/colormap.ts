// 값→색상 매핑(온도·습도·유동 범례 공통) —
// technical-review/pig-farm-cfd-demo/src/colormap.js 포팅(docs/07-starter-kit-assets.md).
// 색상 보간 수식 자체는 그대로 두고 TS 타입만 추가했다.
export type RGB01 = readonly [number, number, number];

// 원본(포팅 당시) 색상 기준점 — hue·밝기는 이 값 그대로 두고, 채도만 아래 SATURATION_BOOST로
// 일괄 조정한다(2026-10-10 사용자 요청 — "채도를 퍼센트로 일괄 적용, 값을 두 번씩 바꾸지
// 않게"). 더 쨍하게/연하게 하려면 BASE_STOPS가 아니라 SATURATION_BOOST 숫자 하나만 바꾸면
// 전체 색상에 한 번에 적용된다.
const BASE_STOPS: ReadonlyArray<readonly [number, RGB01]> = [
  [0.0, [0.19, 0.3, 0.85]],
  [0.3, [0.1, 0.6, 0.85]],
  [0.55, [0.35, 0.8, 0.35]],
  [0.75, [0.95, 0.8, 0.15]],
  [1.0, [0.9, 0.2, 0.15]],
];

// 1.0 = 원본 채도 그대로, 2.0 = 채도 2배(흰색 섞인 비율을 절반으로). 1보다 작으면 더 연하게.
const SATURATION_BOOST = 1;

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

const STOPS: ReadonlyArray<readonly [number, RGB01]> = BASE_STOPS.map(([t, c]) => [
  t,
  boostSaturation(c, SATURATION_BOOST),
]);

/** 0~1로 정규화된 값을 RGB(0~1)로 변환한다. */
export function colormapRGB01(tInput: number): RGB01 {
  const t = Math.min(Math.max(tInput, 0), 1);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const stop0 = STOPS[i];
    const stop1 = STOPS[i + 1];
    if (!stop0 || !stop1) continue;
    const [t0, c0] = stop0;
    const [t1, c1] = stop1;
    if (t >= t0 && t <= t1) {
      const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return [
        c0[0] + (c1[0] - c0[0]) * f,
        c0[1] + (c1[1] - c0[1]) * f,
        c0[2] + (c1[2] - c0[2]) * f,
      ];
    }
  }
  const last = STOPS[STOPS.length - 1];
  return last ? last[1] : [0, 0, 0];
}

/**
 * 응답의 range(min/max, 01-functional-spec.md 3장 "색상 범위는 응답의 range 기준")로
 * 값을 0~1로 정규화한다. min===max(평탄한 응답)면 중간색으로 고정한다.
 */
export function normalize(value: number, min: number, max: number): number {
  const span = max - min;
  if (span <= 0) return 0.5;
  return (value - min) / span;
}

export function valueToRGB01(value: number, min: number, max: number): RGB01 {
  return colormapRGB01(normalize(value, min, max));
}

export function valueToRGB255(
  value: number,
  min: number,
  max: number,
): readonly [number, number, number] {
  const [r, g, b] = valueToRGB01(value, min, max);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
