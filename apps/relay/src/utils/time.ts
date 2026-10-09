// 시간 관련 순수 유틸. docs/02-relay-api.md 1장: 대시보드 응답 시간은 ISO 8601 + "+09:00".

/** 센서 서버 timestamp(타임존 없음, KST로 간주)에 +09:00을 붙인다. docs/03-upstream-apis.md 1.1. */
export function toKstIso(timestamp: string): string {
  return `${timestamp}+09:00`;
}

/** 현재 시각을 KST ISO 8601(+09:00 표기)로 반환한다. requestedAt·baseAt 등에 사용. */
export function nowKstIso(date: Date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().replace('Z', '+09:00');
}

/**
 * 기상청 발표 시각 계산 등 "날짜 경계를 넘는 KST 벽시계 연산"에 쓰는 Date를 만든다.
 * 반환된 Date의 getUTC*() 값이 곧 KST 벽시계 값이 되도록 UTC 필드에 KST 값을 그대로 담는다.
 * (호스트 OS 타임존에 의존하지 않고 결정적으로 테스트하기 위한 트릭 — isNight처럼 실제 UTC 순간이
 *  필요한 계산에는 쓰지 않는다.)
 */
export function kstWallClock(date: Date = new Date()): Date {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

/** 문자열(+09:00 부착 완료) 중 가장 최신 timestamp를 고른다. 없으면 null. */
export function latestIso(timestamps: (string | null)[]): string | null {
  const valid = timestamps.filter((t): t is string => t !== null);
  if (valid.length === 0) return null;
  return valid.reduce((latest, cur) => (new Date(cur).getTime() > new Date(latest).getTime() ? cur : latest));
}

/** 문자열(숫자 아닐 수 있음)을 숫자로, 실패하면 null. */
export function toNumberOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * kstWallClock()이 반환한 Date(getUTC*가 KST 벽시계 값)를 "YYYYMMDDHHmm"으로 포맷한다.
 * 센서 서버 이력 조회(`?start=...&end=...`, docs/03-upstream-apis.md 1.2)에 쓴다.
 */
export function formatKstWallClockCompact(d: Date): string {
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  const hh = pad2(d.getUTCHours());
  const mm = pad2(d.getUTCMinutes());
  return `${y}${m}${day}${hh}${mm}`;
}

/**
 * kstWallClock() 결과 Date를 센서 서버 timestamp 형식(타임존 없음, 분 단위)으로 포맷한다.
 * "YYYY-MM-DDTHH:mm:00" — 센서 응답의 timestamp 문자열과 그대로 비교할 수 있는 키로 쓴다.
 */
export function formatKstWallClockNaive(d: Date): string {
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  const hh = pad2(d.getUTCHours());
  const mm = pad2(d.getUTCMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}:00`;
}

/** kstWallClock() 결과 Date를 Iso8601(+09:00) 문자열로 포맷한다. */
export function formatKstWallClockIso(d: Date): string {
  return `${formatKstWallClockNaive(d)}+09:00`;
}
