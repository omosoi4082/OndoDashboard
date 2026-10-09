// docs/02-relay-api.md 6장 "current 입력 구간": 이미 완료된 분 중 가장 최근의 10분 단위
// 정각(00·10·20·30·40·50분)이 끝, 180분 전이 시작.
// kmaBaseTime.ts와 같은 패턴: 입력 Date는 kstWallClock()으로 이미 변환된 "KST 벽시계 값을
// UTC 필드에 담은" Date여야 한다(호스트 타임존 의존 없이 결정적으로 계산하기 위함).
// 반환하는 Date도 같은 표현을 쓴다 — 포맷은 utils/time.ts의 formatKstWallClock*로 한다.

export interface TenMinuteWindow {
  /** 구간 끝(포함) — 완료된 가장 최근 10분 단위 정각. */
  endMin: Date;
  /** 구간 시작(포함) — endMin에서 180분 전. */
  startMin: Date;
}

const WINDOW_MINUTES = 180;
const MINUTE_MS = 60_000;
const TEN_MINUTE_MS = 10 * MINUTE_MS;

/**
 * 현재 진행 중인 분은 아직 완료되지 않았으므로, "가장 최근 완료된 분"은 현재 분의 1분 전이다.
 * 예: 15:26(초 무관) → 완료된 분 15:25 → 10분 정각 15:20.
 *     15:20:30 → 완료된 분 15:19 → 10분 정각 15:10(15:20분은 아직 안 끝남).
 */
export function completedTenMinuteWindow(kstNow: Date): TenMinuteWindow {
  const flooredMinuteMs = Math.floor(kstNow.getTime() / MINUTE_MS) * MINUTE_MS;
  const lastCompletedMinuteMs = flooredMinuteMs - MINUTE_MS;
  const endMs = Math.floor(lastCompletedMinuteMs / TEN_MINUTE_MS) * TEN_MINUTE_MS;
  const startMs = endMs - WINDOW_MINUTES * MINUTE_MS;
  return { endMin: new Date(endMs), startMin: new Date(startMs) };
}

/** startMin~endMin(포함) 1분 간격 Date 배열(181개). */
export function minuteMarks(startMin: Date, endMin: Date): Date[] {
  const marks: Date[] = [];
  for (let t = startMin.getTime(); t <= endMin.getTime(); t += MINUTE_MS) {
    marks.push(new Date(t));
  }
  return marks;
}

/** startMin~endMin(포함) 5분 간격 Date 배열(37개, docs/02-relay-api.md 6장). */
export function fiveMinuteMarks(startMin: Date, endMin: Date): Date[] {
  const marks: Date[] = [];
  const fiveMinMs = 5 * MINUTE_MS;
  for (let t = startMin.getTime(); t <= endMin.getTime(); t += fiveMinMs) {
    marks.push(new Date(t));
  }
  return marks;
}
