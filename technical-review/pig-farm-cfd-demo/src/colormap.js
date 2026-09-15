const STOPS = [
  [0.00, [0.19, 0.30, 0.85]],
  [0.30, [0.10, 0.60, 0.85]],
  [0.55, [0.35, 0.80, 0.35]],
  [0.75, [0.95, 0.80, 0.15]],
  [1.00, [0.90, 0.20, 0.15]],
];

export function colormap(t) {
  t = Math.min(Math.max(t, 0), 1);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [t0, c0] = STOPS[i], [t1, c1] = STOPS[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return STOPS[STOPS.length - 1][1];
}
