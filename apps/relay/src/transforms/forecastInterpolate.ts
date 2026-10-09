// docs/02-relay-api.md 6장 "forecast"·docs/03-upstream-apis.md 2장 "예측 입력 계산(series
// 형식)". 기상청 단기예보(getVilageFcst) 정시 TMP·REH → 5분 간격 288건 보간 + fan_pct 계산.
// 순수 함수 + 단위 테스트(자정 넘김, 결측·보간, 경계값 포함).
import { analyzeGaps, interpolateShortGaps } from './aggregate5min.js';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * from~to(포함) 1시간 간격 Date 배열. from·to는 kstWallClock() 표현(getUTC*가 KST 벽시계 값)
 * 이어야 하며, 자정·월 경계를 넘어도 Date 연산이므로 그대로 올바르게 넘어간다.
 */
export function hourlyMarks(from: Date, to: Date): Date[] {
  const marks: Date[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += HOUR_MS) {
    marks.push(new Date(t));
  }
  return marks;
}

/** mark를 정시(해당 시 00분)로 내림한다. kstWallClock() 표현 기준. */
export function floorToHour(mark: Date): Date {
  const ms = Math.floor(mark.getTime() / HOUR_MS) * HOUR_MS;
  return new Date(ms);
}

/** mark를 정시로 올림한다(이미 정시면 그대로). kstWallClock() 표현 기준. */
export function ceilToHour(mark: Date): Date {
  const ms = Math.ceil(mark.getTime() / HOUR_MS) * HOUR_MS;
  return new Date(ms);
}

export interface HourlyPoint {
  time: Date;
  value: number;
}

/**
 * hourMarks 각 시각에 대해 hourlyByKey(키: "YYYY-MM-DDTHH:mm:00" KST naive)에서 값을 찾는다.
 * 없으면 null(결측) — 보간은 fillHourlyGaps에서 별도로 처리한다.
 */
export function hourlyValuesAtMarks(hourMarks: readonly Date[], hourlyByKey: ReadonlyMap<string, number>): (number | null)[] {
  return hourMarks.map((mark) => hourlyByKey.get(hourKeyOf(mark)) ?? null);
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** kstWallClock() 표현 Date → "YYYY-MM-DDTHH:mm:00" 키(분은 항상 00, 정시 기준). */
export function hourKeyOf(mark: Date): string {
  const y = mark.getUTCFullYear();
  const m = pad2(mark.getUTCMonth() + 1);
  const d = pad2(mark.getUTCDate());
  const hh = pad2(mark.getUTCHours());
  return `${y}-${m}-${d}T${hh}:00:00`;
}

export interface FillHourlyGapsResult {
  /** 결측 없는(또는 짧은 결측만 보간한) 값들. failed=true면 참고용(오류 처리는 호출부 책임). */
  values: (number | null)[];
  /** 연속 결측이 maxGapHours 이상이면 true — "기상청 예보 조회 실패"로 처리(호출부). */
  failed: boolean;
}

/**
 * 1시간 값 결측 처리(docs/03 2장): 앞뒤 정시 값으로 선형 보간, 연속 결측이 maxGapHours
 * 이상이면 실패로 표시한다. aggregate5min.ts의 범용 결측 분석·보간 함수를 그대로 재사용한다
 * (도메인에 의존하지 않는 순수 배열 연산이므로 "연속 결측 길이" 기준만 다르게 적용).
 */
export function fillHourlyGaps(values: readonly (number | null)[], maxGapHours: number): FillHourlyGapsResult {
  const gapInfo = analyzeGaps(values);
  if (gapInfo.maxConsecutiveGap >= maxGapHours) {
    return { values: [...values], failed: true };
  }
  // maxGapHours보다 짧은 결측만 있다고 확인했으므로, 보간 허용 폭을 넉넉히 줘도 안전하다.
  const filled = interpolateShortGaps(values, maxGapHours);
  return { values: filled, failed: false };
}

/** primary(최신 발표분) 결측 슬롯만 fallback(직전 발표분) 값으로 채운다. */
export function mergeHourlyFallback(primary: readonly (number | null)[], fallback: readonly (number | null)[]): (number | null)[] {
  return primary.map((v, i) => v ?? fallback[i] ?? null);
}

/**
 * markTime(5분 단위 등 임의 시각)의 값을 hourMarks/hourValues(결측 없는 정시 값)로 선형
 * 보간한다. markTime이 hourMarks 범위 밖이면 가장 가까운 끝 값을 쓴다(docs/03 2장 "해당
 * 시간대 값이 없으면 가장 가까운 다음 시각 값").
 */
export function interpolateAtTime(markTime: Date, hourMarks: readonly Date[], hourValues: readonly number[]): number {
  const n = hourMarks.length;
  if (n === 0) return 0;
  if (n === 1) return hourValues[0] ?? 0;

  const t = markTime.getTime();
  const first = hourMarks[0];
  const last = hourMarks[n - 1];
  if (first && t <= first.getTime()) return hourValues[0] ?? 0;
  if (last && t >= last.getTime()) return hourValues[n - 1] ?? 0;

  for (let i = 0; i < n - 1; i += 1) {
    const left = hourMarks[i];
    const right = hourMarks[i + 1];
    if (!left || !right) continue;
    if (t >= left.getTime() && t <= right.getTime()) {
      const leftVal = hourValues[i];
      const rightVal = hourValues[i + 1];
      if (leftVal === undefined || rightVal === undefined) return leftVal ?? rightVal ?? 0;
      const span = right.getTime() - left.getTime();
      if (span === 0) return leftVal; // 보간 어려움 — 동일값 유지
      const ratio = (t - left.getTime()) / span;
      return leftVal + (rightVal - leftVal) * ratio;
    }
  }
  // 이론상 도달하지 않음(범위 내 처리 완료) — 방어적 fallback.
  return hourValues[n - 1] ?? 0;
}

/** 5분 간격 마크(count개, 첫 마크 from부터) 배열. */
export function fiveMinuteSeriesMarks(from: Date, count: number): Date[] {
  const marks: Date[] = [];
  for (let i = 0; i < count; i += 1) {
    marks.push(new Date(from.getTime() + i * 5 * MINUTE_MS));
  }
  return marks;
}

export interface FanPctConfig {
  tLow: number; // FAN_T_LOW
  tHigh: number; // FAN_T_HIGH
  min: number; // FAN_MIN
  max: number; // FAN_MAX
}

/**
 * 예보 구간 fan_pct(docs/03 2장): clamp(min + (max-min)*(T_out-tLow)/(tHigh-tLow), min, max),
 * 소수 1자리 반올림. null을 쓰지 않는다(센서 결측과 달리 항상 값을 만들어낸다).
 */
export function fanPctFromTemp(tOut: number, cfg: FanPctConfig): number {
  const span = cfg.tHigh - cfg.tLow;
  const raw = span === 0 ? cfg.min : cfg.min + (cfg.max - cfg.min) * ((tOut - cfg.tLow) / span);
  const clamped = Math.min(cfg.max, Math.max(cfg.min, raw));
  return Math.round(clamped * 10) / 10;
}
