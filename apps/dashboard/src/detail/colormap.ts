// 값→색상 매핑(온도·습도·유동 범례 공통) —
// technical-review/pig-farm-cfd-demo/src/colormap.js 포팅(docs/07-starter-kit-assets.md).
// 색상 보간 수식 자체는 그대로 두고 TS 타입만 추가했다.
export type RGB01 = readonly [number, number, number];

// 2026-10-10 사용자 요청으로 채도를 올림(기존 값이 파스텔톤으로 너무 연해 보임) — 색상 자체
// (hue)·밝기는 유지하고 중간톤(특히 초록)의 흰색 섞인 정도만 줄였다.
const STOPS: ReadonlyArray<readonly [number, RGB01]> = [
  [0.0, [0.08, 0.2, 0.9]],
  [0.3, [0.0, 0.55, 0.9]],
  [0.55, [0.15, 0.85, 0.15]],
  [0.75, [1.0, 0.85, 0.0]],
  [1.0, [0.95, 0.1, 0.1]],
];

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
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
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

export function valueToRGB255(value: number, min: number, max: number): readonly [number, number, number] {
  const [r, g, b] = valueToRGB01(value, min, max);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
