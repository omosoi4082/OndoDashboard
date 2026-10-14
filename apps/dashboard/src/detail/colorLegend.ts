// 색 범례(그라데이션 막대 + 값 눈금) 순수 로직 — 2D 단면(Detail2DSection)과 3D 뷰
// (Detail3DView) 오버레이가 같은 ColorLegend 컴포넌트로 공유한다(2026-10-14 B-8:
// "3D에도 범례"). 색은 colormap.ts, 눈금은 axisTicks.ts의 niceAxisTicks를 그대로 쓴다.
import type { ValueField } from '../store/detailStore.js';
import { colormapRGB01 } from './colormap.js';

export const LEGEND_STEPS = 24;

/**
 * CSS linear-gradient(to bottom, ...)용 색상 정지점 목록.
 *
 * 정지점은 반드시 오름차순 퍼센트로 나열해야 한다 — 내림차순으로 주면 두 번째 정지점부터
 * 전부 이전 값으로 클램프돼 그라데이션이 단색으로 뭉개진다(2026-10-10 확인 — 범례 막대가
 * 늘 단색 파랑으로만 보였던 원인). pct는 0%(막대 위, 최댓값)→100%(막대 아래, 최솟값)로
 * 오름차순 유지, 컬러맵 t는 그 반대로 간다.
 */
export function legendGradientStops(field: ValueField, steps: number = LEGEND_STEPS): string {
  const n = Math.max(2, Math.floor(steps));
  return Array.from({ length: n }, (_, i) => {
    const pct = (i / (n - 1)) * 100;
    const t = 1 - i / (n - 1);
    const [r, g, b] = colormapRGB01(t, field);
    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}) ${pct.toFixed(1)}%`;
  }).join(', ');
}

/** 값 v의 막대 위 세로 위치(%, 0 = 위 = max, 100 = 아래 = min). min==max여도 0으로 나누지 않는다. */
export function legendTickTopPct(v: number, min: number, max: number): number {
  const span = Math.max(max - min, 1e-9);
  return (1 - (v - min) / span) * 100;
}
