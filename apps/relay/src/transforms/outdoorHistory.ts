// 2026-10-13 B-3: 현재·예측 모드 과거 3시간 외기 온·습도(T_out·RH_out)를 기상청 초단기실황
// 정시 값으로 만든다(센서 WS1 이력 미제공 — 05-open-questions #34). 매시간 적재하지 않고
// 조회 시점에 최근 정시 4회를 직접 조회한다(회신문 2장 — 재시작 직후에도 3시간 복구 가능).
// 입력·반환 Date는 kstWallClock() 표현(currentWindow.ts와 같은 규칙).
import type { TenMinuteWindow } from './currentWindow.js';
import { floorToHour, hourlyMarks, interpolateAtTime } from './forecastInterpolate.js';

/**
 * 입력 구간(180분)을 덮는 정시 목록. 시작 정시(내림) ~ 끝 정시(내림)이라 항상 4개다
 * (예: 12:20~15:20 → 12·13·14·15시, 12:00~15:00 → 12·13·14·15시).
 */
export function outdoorHourMarks(window: TenMinuteWindow): Date[] {
  return hourlyMarks(floorToHour(window.startMin), floorToHour(window.endMin));
}

/** 기상청 obsrValue 문자열 → 숫자. 숫자가 아니거나 범위 밖(결측 표기 −998.9 등)이면 null. */
export function parseObservedValue(raw: string | undefined, min: number, max: number): number | null {
  if (raw === undefined || raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export type OutdoorSeriesResult = { ok: true; values: number[] } | { ok: false };

/**
 * 정시 값(결측 null 포함) → 5분 마크 값.
 * - 연속 2개 이상 결측(또는 전부 결측)이면 실패 — '기상청 실황 조회 실패'로 연산 서버를 호출하지 않는다.
 * - 결측 1개: 위치와 관계없이 앞뒤 값이 모두 있으면 선형 보간, 한쪽만 있으면 가까운 쪽 값을 그대로 쓴다
 *   (맨 앞이면 다음 값, 맨 뒤면 직전 값). 2026-10-15 온도 측 확정 — 05-open-questions.md #42.
 * - 5분 마크는 정시 사이 선형 보간, 마지막 관측 이후는 마지막 값을 유지한다.
 * 반올림하지 않는다.
 */
export function outdoorFiveMinuteSeries(
  hourMarks: readonly Date[],
  hourValues: readonly (number | null)[],
  fiveMinMarks: readonly Date[],
): OutdoorSeriesResult {
  if (hourMarks.length === 0 || hourMarks.length !== hourValues.length) return { ok: false };

  for (let i = 0; i + 1 < hourValues.length; i += 1) {
    if (hourValues[i] === null && hourValues[i + 1] === null) return { ok: false };
  }

  const filled: number[] = [];
  for (let i = 0; i < hourValues.length; i += 1) {
    const v = hourValues[i];
    if (v !== null && v !== undefined) {
      filled.push(v);
      continue;
    }
    const prev = hourValues[i - 1] ?? null;
    const next = hourValues[i + 1] ?? null;
    if (prev !== null && next !== null) filled.push((prev + next) / 2);
    else if (prev !== null) filled.push(prev);
    else if (next !== null) filled.push(next);
    else return { ok: false }; // 정시가 1개뿐인데 그것도 결측
  }

  return { ok: true, values: fiveMinMarks.map((mark) => interpolateAtTime(mark, hourMarks, filled)) };
}
