// docs/03-upstream-apis.md 2장 "발표 시각 계산"(순수 함수 + 테스트, 자정 넘김 포함).
// `now`는 utils/time.ts의 kstWallClock()로 만든 Date를 넘긴다 — 이 Date의 getUTC*() 값을
// KST 벽시계 값으로 취급한다(호스트 타임존 의존 없이 결정적으로 계산하기 위함).

export interface KmaBaseTime {
  baseDate: string; // YYYYMMDD
  baseTime: string; // HHmm
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDate(y: number, m: number, d: number): string {
  return `${y}${pad2(m)}${pad2(d)}`;
}

/** y/m(1-based)/d에 delta일을 더한 뒤(월/연 경계 자동 보정) 정규화된 y/m/d를 돌려준다. */
function addDays(y: number, m: number, d: number, delta: number): { y: number; m: number; d: number } {
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** 매시 정각(HH00 또는 HH30)에 발표되는 시리즈의 slot 계산 공통 로직. */
function hourlySlot(now: Date, stepsBack: number, minuteStr: string): KmaBaseTime {
  const h = now.getUTCHours();
  const totalHours = h - stepsBack;
  const dayOffset = Math.floor(totalHours / 24);
  let hour = totalHours % 24;
  if (hour < 0) hour += 24;
  const { y, m, d } = addDays(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(), dayOffset);
  return { baseDate: formatDate(y, m, d), baseTime: `${pad2(hour)}${minuteStr}` };
}

/**
 * 초단기실황(getUltraSrtNcst) 발표 시각: 매시 HH00.
 * stepsBack=0은 현재 시각이 속한 시(hour)의 정각, stepsBack=1은 그 직전(NO_DATA 재요청용).
 */
export function ultraSrtNcstBaseTime(now: Date, stepsBack = 0): KmaBaseTime {
  return hourlySlot(now, stepsBack, '00');
}

/**
 * 초단기예보(getUltraSrtFcst) 발표 시각: 매시 HH30.
 * 분이 30 미만이면 아직 그 시각 발표 전이므로 한 시간 전 HH30을 쓴다.
 */
export function ultraSrtFcstBaseTime(now: Date, stepsBack = 0): KmaBaseTime {
  const extra = now.getUTCMinutes() >= 30 ? 0 : 1;
  return hourlySlot(now, stepsBack + extra, '30');
}

const VILAGE_FCST_HOURS = [2, 5, 8, 11, 14, 17, 20, 23] as const;

/**
 * 단기예보(getVilageFcst) 발표 시각: 02·05·08·11·14·17·20·23시(모두 정각).
 * 자정을 넘겨 당일 02시 이전이면 전날 23시 발표분을 쓴다.
 */
export function vilageFcstBaseTime(now: Date, stepsBack = 0): KmaBaseTime {
  const hours = VILAGE_FCST_HOURS;
  const n = hours.length;
  const h = now.getUTCHours();

  let dayOffset = 0;
  let idx = -1;
  for (let i = n - 1; i >= 0; i -= 1) {
    const slotHour = hours[i];
    if (slotHour !== undefined && slotHour <= h) {
      idx = i;
      break;
    }
  }
  if (idx === -1) {
    // 당일 첫 발표(02시) 이전 — 전날 23시 발표분이 현재 유효한 가장 최근 발표.
    dayOffset = -1;
    idx = n - 1;
  }

  let remaining = stepsBack;
  while (remaining > 0) {
    idx -= 1;
    if (idx < 0) {
      idx = n - 1;
      dayOffset -= 1;
    }
    remaining -= 1;
  }

  const { y, m, d } = addDays(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(), dayOffset);
  const slotHour = hours[idx];
  // idx는 항상 0..n-1 범위이므로 slotHour는 항상 존재한다(noUncheckedIndexedAccess 방어).
  return { baseDate: formatDate(y, m, d), baseTime: `${pad2(slotHour ?? 23)}00` };
}

/** KmaBaseTime(YYYYMMDD/HHmm) → Iso8601(+09:00) 문자열. */
export function kmaBaseTimeToIso(bt: KmaBaseTime): string {
  const y = bt.baseDate.slice(0, 4);
  const m = bt.baseDate.slice(4, 6);
  const d = bt.baseDate.slice(6, 8);
  const hh = bt.baseTime.slice(0, 2);
  const mm = bt.baseTime.slice(2, 4);
  return `${y}-${m}-${d}T${hh}:${mm}:00+09:00`;
}
