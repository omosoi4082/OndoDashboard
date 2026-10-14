// 연산 서버 오류 재시도(2026-10-13 온도 측 D-4 확정). ComputeClient를 감싸는 데코레이터로,
// COMPUTE_MODE=http일 때만 computeClientFactory.ts에서 씌운다(mock은 code를 내지 않는다).
//
// - BAD_REQUEST: 재시도하지 않는다(입력이 같으면 결과도 같다). 메시지는 파싱 단계에서 field 포함.
// - SERVER: delayMs(기본 1분) 뒤 1회 재시도. 그래도 실패하면 '예측 서버 오류'.
// - BUSY: delayMs 뒤 재시도. 횟수는 온도 측이 정하지 않아 가장 단순하게 1회로 둔다
//   (SERVER와 같은 규칙). 그래도 실패하면 BUSY_FINAL_MESSAGE.
// - code 없음(구버전 목업·본문 없는 HTTP 오류)·타임아웃·연결 실패: 재시도하지 않는다.
import type { ComputeClient, ComputeErrResult, ComputeResult, ComputeUpstreamCode } from './computeClient.js';

export const SERVER_FINAL_MESSAGE = '예측 서버 오류';
export const BUSY_FINAL_MESSAGE = '예측 서버가 다른 계산 중이라 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.';

const RETRY_CODES: readonly ComputeUpstreamCode[] = ['SERVER', 'BUSY'];

export interface ComputeRetryOpts {
  delayMs: number;
  /** 테스트에서 실제로 기다리지 않도록 주입한다. 기본은 setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** 이 결과가 재시도 대상인지(순수 함수). */
export function shouldRetryCompute(result: ComputeResult): boolean {
  return !result.ok && result.upstreamCode !== undefined && RETRY_CODES.includes(result.upstreamCode);
}

/** 재시도까지 실패했을 때 화면에 보낼 결과(순수 함수). SERVER·BUSY만 문구를 바꾼다. */
export function finalizeComputeError(result: ComputeErrResult): ComputeErrResult {
  if (result.upstreamCode === 'SERVER') return { ...result, message: SERVER_FINAL_MESSAGE };
  if (result.upstreamCode === 'BUSY') return { ...result, message: BUSY_FINAL_MESSAGE };
  return result;
}

async function runWithRetry(
  call: () => Promise<ComputeResult>,
  delayMs: number,
  sleep: (ms: number) => Promise<void>,
): Promise<ComputeResult> {
  const first = await call();
  if (!shouldRetryCompute(first)) return first;
  if (!first.ok) {
    console.warn(`[compute] ${first.upstreamCode ?? ''} 오류 — ${delayMs}ms 뒤 1회 재시도: ${first.message}`);
  }
  await sleep(delayMs);
  const second = await call();
  if (second.ok) return second;
  return finalizeComputeError(second);
}

export function withComputeRetry(client: ComputeClient, opts: ComputeRetryOpts): ComputeClient {
  const sleep = opts.sleep ?? defaultSleep;
  return {
    ping: () => client.ping(),
    requestCurrent: (inputs) => runWithRetry(() => client.requestCurrent(inputs), opts.delayMs, sleep),
    requestForecast: (inputs, extra) =>
      runWithRetry(() => client.requestForecast(inputs, extra), opts.delayMs, sleep),
  };
}
