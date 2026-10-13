// 목업 응답 파일(온도 측 제공)의 프레임 시각을 **지금 기준으로 다시 깔아주는** 변환.
//
// 왜 필요한가: 연산 서버를 아직 붙이지 못해 COMPUTE_MODE=mock이 mock/sample_response_*.json을
// 읽어 돌려주는데(2026-10-13 온도 측 C), 그 파일의 시각은 2026-10-05로 고정돼 있다. 현재
// 모드는 "지금"을 보여주는 화면이라 날짜가 열흘 전으로 찍히면 화면이 말이 안 된다.
// 그래서 **시각만 요청 기준으로 바꾸고 값(온도·습도·유동·summary·outdoor)은 파일 그대로**
// 쓴다 — 말 그대로 테스트 데이터로 쓰되 시간축만 현실에 맞추는 것이다(사용자 결정).
//
// 값을 건드리지 않는 이유: 파일의 숫자는 온도 측이 만든 결과 형태라 그대로 보여주는 것이
// 목적이고, outdoor까지 우리 입력으로 덮으면 "값은 파일, 외기는 실측"이 섞여 어느 쪽도
// 설명하기 어려운 화면이 된다. 연산 서버가 붙으면 이 변환은 쓰이지 않는다(http 클라이언트
// 경로에는 적용하지 않는다).
import type { ComputeFrame } from '../clients/computeClient.js';

const MINUTE_MS = 60_000;

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * "YYYY-MM-DDTHH:MM:SS"(타임존 없음, KST로 간주) → Date. 반환 Date의 getUTC*가 곧 그
 * 벽시계 값이다(utils/time.ts kstWallClock과 같은 표현). 형식이 아니면 null.
 */
export function parseNaiveKst(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const [, y, mo, d, hh, mi, ss] = m;
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mi), Number(ss));
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** parseNaiveKst의 역변환 — "YYYY-MM-DDTHH:MM:SS"(초 포함). */
export function formatNaiveKst(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  const hh = pad2(d.getUTCHours());
  const mi = pad2(d.getUTCMinutes());
  const ss = pad2(d.getUTCSeconds());
  return `${y}-${mo}-${day}T${hh}:${mi}:${ss}`;
}

export type RebaseResult = { ok: true; frames: ComputeFrame[] } | { ok: false; message: string };

/**
 * frames[i].time을 `startNaive + i × intervalMin분`으로 다시 매긴다. 그 밖의 필드는 전부
 * 그대로 복사한다(얕은 복사 — 값 배열은 공유해도 아무도 변형하지 않는다).
 *
 * @param startNaive 프레임 0이 가질 시각("YYYY-MM-DDTHH:MM:SS", 보통 마지막 실측 시각)
 * @param intervalMin 프레임 간격(current는 프레임이 1개라 무의미, forecast는 10)
 */
export function rebaseFrameTimes(
  frames: readonly ComputeFrame[],
  startNaive: string,
  intervalMin: number,
): RebaseResult {
  const start = parseNaiveKst(startNaive);
  if (!start) {
    return { ok: false, message: `기준 시각 형식이 올바르지 않습니다: ${startNaive}` };
  }
  const rebased = frames.map((frame, i) => ({
    ...frame,
    time: formatNaiveKst(new Date(start.getTime() + i * intervalMin * MINUTE_MS)),
  }));
  return { ok: true, frames: rebased };
}
