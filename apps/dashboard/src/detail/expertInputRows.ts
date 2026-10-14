// 전문가 모드 입력 표(B-2)의 행 시각과 예시 값.
// 행 = 1시간 간격 24개, 첫 행 = 현재 시각 다음 정시(docs/04-tasks.md P2).
import type { ExpertRowDraft } from './expertInputValidation.js';

/**
 * 예시 값 — 온도 측 mock/mock_expert.json의 input 중 정시 값 24개(2026-10-05 16:00 ~
 * 10-06 15:00)를 순서대로 옮겼다(T_out·RH_out·fan_pct). "예시 값"이라 행 라벨 시각과 원래
 * 시각이 어긋나는 것은 무시한다(docs/04-tasks.md P2).
 */
const EXAMPLE_VALUES: ReadonlyArray<readonly [number, number, number]> = [
  [37.17, 59.2, 100],
  [36.77, 59.7, 100],
  [36.25, 60.4, 100],
  [35.65, 61.2, 100],
  [35.0, 62.0, 100],
  [34.35, 62.8, 100],
  [33.75, 63.6, 100],
  [33.23, 64.3, 100],
  [32.83, 64.8, 100],
  [32.59, 65.1, 100],
  [32.5, 65.2, 100],
  [32.59, 65.1, 100],
  [32.83, 64.8, 100],
  [33.23, 64.3, 100],
  [33.75, 63.6, 100],
  [34.35, 62.8, 100],
  [35.0, 62.0, 100],
  [35.65, 61.2, 100],
  [36.25, 60.4, 100],
  [36.77, 59.7, 100],
  [37.17, 59.2, 100],
  [37.41, 58.9, 100],
  [37.5, 58.8, 100],
  [37.41, 58.9, 100],
];

export function expertExampleDrafts(): ExpertRowDraft[] {
  return EXAMPLE_VALUES.map(([temp, rh, vent]) => ({ temp: String(temp), rh: String(rh), vent: String(vent) }));
}

/** now 다음 정시부터 1시간 간격 count개. 정시 정각(예: 15:00:00.000)이면 16:00부터. */
export function expertRowTimes(now: Date, count: number): Date[] {
  const first = new Date(now);
  first.setMinutes(0, 0, 0);
  first.setHours(first.getHours() + 1);
  return Array.from({ length: count }, (_, i) => new Date(first.getTime() + i * 3_600_000));
}

/** 행 라벨 "HH:00". 날짜가 바뀌는 00:00 행만 "MM-DD 00:00"으로 쓴다. */
export function formatExpertRowTime(date: Date): string {
  const hh = date.getHours().toString().padStart(2, '0');
  if (date.getHours() === 0) {
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    return `${mm}-${dd} ${hh}:00`;
  }
  return `${hh}:00`;
}
