// 연산 서버 오류 재시도(2026-10-13 온도 측 D-4). ComputeClient를 감싸는 데코레이터로,
// COMPUTE_MODE=http일 때만 computeClientFactory.ts에서 씌운다(mock은 code를 내지 않는다).
//
// - BAD_REQUEST: 재시도하지 않는다(입력이 같으면 결과도 같다). 메시지는 파싱 단계에서 field 포함.
// - SERVER: delayMs(기본 1분) 뒤 1회 재시도. 그래도 실패하면 '예측 서버 오류'.
// - BUSY: busyDelaysMs에 적은 대기를 차례로 쓰며 그 횟수만큼 재시도한다(기본 15초→30초→1분,
//   2026-10-30 온도 측 "BUSY를 받으면 조금 더 길게 기다렸다 재시도"). 짧은 겹침은 빨리 복구하고
//   오래 걸리는 계산은 끝날 때까지 기다린다. 그래도 실패하면 BUSY_FINAL_MESSAGE.
//   요청을 한 건씩 보내는 줄 세우기는 clients/computeQueue.ts가 따로 맡는다.
// - code 없음(구버전 목업·본문 없는 HTTP 오류)·타임아웃·연결 실패: 재시도하지 않는다.
import type { ComputeClient, ComputeErrResult, ComputeResult, ComputeUpstreamCode } from './computeClient.js';

export const SERVER_FINAL_MESSAGE = '예측 서버 오류';
export const BUSY_FINAL_MESSAGE = '예측 서버가 다른 계산 중이라 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.';

const RETRY_CODES: readonly ComputeUpstreamCode[] = ['SERVER', 'BUSY'];

export interface ComputeRetryOpts {
  /** SERVER 오류 재시도 대기(1회). */
  delayMs: number;
  /** BUSY 오류 재시도 대기 순서. 비우면 delayMs 1회와 같다. */
  busyDelaysMs?: readonly number[];
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

/**
 * 몇 번째 재시도에 얼마나 기다릴지(순수 함수). 범위를 넘으면 undefined — 더 기다리지 않는다.
 * BUSY와 SERVER가 번갈아 나오면 그때 code의 표에서 지금까지의 재시도 횟수로 고른다(가장 단순한 규칙).
 */
export function retryDelayFor(
  result: ComputeErrResult,
  attempt: number,
  opts: Pick<ComputeRetryOpts, 'delayMs' | 'busyDelaysMs'>,
): number | undefined {
  const schedule =
    result.upstreamCode === 'BUSY' && opts.busyDelaysMs && opts.busyDelaysMs.length > 0
      ? opts.busyDelaysMs
      : [opts.delayMs];
  return schedule[attempt];
}

async function runWithRetry(
  call: () => Promise<ComputeResult>,
  opts: ComputeRetryOpts,
  sleep: (ms: number) => Promise<void>,
): Promise<ComputeResult> {
  let result = await call();
  let attempt = 0;
  while (!result.ok && shouldRetryCompute(result)) {
    const delayMs = retryDelayFor(result, attempt, opts);
    if (delayMs === undefined) break;
    console.warn(`[compute] ${result.upstreamCode ?? ''} 오류 — ${delayMs}ms 뒤 재시도: ${result.message}`);
    await sleep(delayMs);
    attempt += 1;
    result = await call();
  }
  return result.ok ? result : finalizeComputeError(result);
}

export function withComputeRetry(client: ComputeClient, opts: ComputeRetryOpts): ComputeClient {
  const sleep = opts.sleep ?? defaultSleep;
  return {
    ping: () => client.ping(),
    requestCurrent: (inputs) => runWithRetry(() => client.requestCurrent(inputs), opts, sleep),
    requestForecast: (inputs, extra) => runWithRetry(() => client.requestForecast(inputs, extra), opts, sleep),
  };
}
