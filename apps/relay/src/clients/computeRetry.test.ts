// D-4(2026-10-13) 연산 서버 오류 재시도: SERVER·BUSY는 대기 후 1회 재시도, BAD_REQUEST·code 없음·
// 타임아웃·연결 실패는 재시도하지 않는다. sleep을 주입해 실제로 기다리지 않는다.
import { describe, expect, it } from 'vitest';
import type { ComputeClient, ComputeErrResult, ComputeOkResult, ComputeResult } from './computeClient.js';
import {
  BUSY_FINAL_MESSAGE,
  SERVER_FINAL_MESSAGE,
  finalizeComputeError,
  shouldRetryCompute,
  withComputeRetry,
} from './computeRetry.js';

const OK: ComputeOkResult = { ok: true, requestId: 'r', modelVersion: 'v', frames: [] };
const SERVER: ComputeErrResult = { ok: false, code: 'UPSTREAM_ERROR', message: 'gpu oom', upstreamCode: 'SERVER' };
const BUSY: ComputeErrResult = { ok: false, code: 'UPSTREAM_ERROR', message: 'busy', upstreamCode: 'BUSY' };
const BAD: ComputeErrResult = {
  ok: false,
  code: 'UPSTREAM_ERROR',
  message: '예측 서버 요청 거부: null (항목: T_out)',
  upstreamCode: 'BAD_REQUEST',
  field: 'T_out',
};
const NO_CODE: ComputeErrResult = { ok: false, code: 'UPSTREAM_ERROR', message: '연산 서버 HTTP 500' };
const TIMEOUT: ComputeErrResult = { ok: false, code: 'UPSTREAM_TIMEOUT', message: '예측 서버 연결 안 됨' };
const UNREACHABLE: ComputeErrResult = { ok: false, code: 'UPSTREAM_UNREACHABLE', message: '예측 서버 연결 안 됨' };

interface Scripted {
  client: ComputeClient;
  calls: string[];
  sleeps: number[];
  sleep: (ms: number) => Promise<void>;
}

/** 결과를 차례로 돌려주는 가짜 클라이언트 + 호출·대기 기록. */
function scripted(results: ComputeResult[]): Scripted {
  const calls: string[] = [];
  const sleeps: number[] = [];
  let i = 0;
  const next = (kind: string): Promise<ComputeResult> => {
    calls.push(kind);
    const r = results[Math.min(i, results.length - 1)];
    i += 1;
    if (!r) return Promise.reject(new Error('결과가 비어 있음'));
    return Promise.resolve(r);
  };
  const client: ComputeClient = {
    ping: () => Promise.resolve(true),
    requestCurrent: () => next('current'),
    requestForecast: () => next('forecast'),
  };
  return {
    client,
    calls,
    sleeps,
    sleep: (ms: number) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
  };
}

describe('shouldRetryCompute', () => {
  it('SERVER·BUSY만 재시도 대상', () => {
    expect(shouldRetryCompute(SERVER)).toBe(true);
    expect(shouldRetryCompute(BUSY)).toBe(true);
    expect(shouldRetryCompute(BAD)).toBe(false);
    expect(shouldRetryCompute(NO_CODE)).toBe(false);
    expect(shouldRetryCompute(TIMEOUT)).toBe(false);
    expect(shouldRetryCompute(UNREACHABLE)).toBe(false);
    expect(shouldRetryCompute(OK)).toBe(false);
  });
});

describe('finalizeComputeError', () => {
  it('SERVER → 예측 서버 오류, BUSY → 바쁨 문구, 그 외는 그대로', () => {
    expect(finalizeComputeError(SERVER).message).toBe(SERVER_FINAL_MESSAGE);
    expect(finalizeComputeError(BUSY).message).toBe(BUSY_FINAL_MESSAGE);
    expect(finalizeComputeError(BAD)).toEqual(BAD);
  });
});

describe('withComputeRetry', () => {
  it('SERVER 후 성공 → 대기 1회 + 두 번째 결과', async () => {
    const s = scripted([SERVER, OK]);
    const result = await withComputeRetry(s.client, { delayMs: 60_000, sleep: s.sleep }).requestCurrent([]);
    expect(result).toEqual(OK);
    expect(s.calls).toEqual(['current', 'current']);
    expect(s.sleeps).toEqual([60_000]);
  });

  it('SERVER가 두 번 → 1회만 재시도하고 "예측 서버 오류"', async () => {
    const s = scripted([SERVER, SERVER, OK]);
    const result = await withComputeRetry(s.client, { delayMs: 10, sleep: s.sleep }).requestCurrent([]);
    expect(s.calls.length).toBe(2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe(SERVER_FINAL_MESSAGE);
    expect(result.code).toBe('UPSTREAM_ERROR');
  });

  it('BUSY 후 성공(forecast도 같은 규칙)', async () => {
    const s = scripted([BUSY, OK]);
    const result = await withComputeRetry(s.client, { delayMs: 10, sleep: s.sleep }).requestForecast([], {
      forecastFrom: '2026-10-05T15:25:00',
      forecastIssuedAt: '2026-10-05T14:00:00',
    });
    expect(result).toEqual(OK);
    expect(s.calls).toEqual(['forecast', 'forecast']);
  });

  it('BUSY가 두 번 → 1회만 재시도하고 바쁨 문구', async () => {
    const s = scripted([BUSY, BUSY]);
    const result = await withComputeRetry(s.client, { delayMs: 10, sleep: s.sleep }).requestCurrent([]);
    expect(s.calls.length).toBe(2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe(BUSY_FINAL_MESSAGE);
  });

  it('재시도에서 타임아웃이 나면 타임아웃 결과 그대로', async () => {
    const s = scripted([SERVER, TIMEOUT]);
    const result = await withComputeRetry(s.client, { delayMs: 10, sleep: s.sleep }).requestCurrent([]);
    expect(result).toEqual(TIMEOUT);
  });

  it.each([
    ['BAD_REQUEST', BAD],
    ['code 없음', NO_CODE],
    ['타임아웃', TIMEOUT],
    ['연결 실패', UNREACHABLE],
  ])('%s → 재시도·대기 없이 그대로', async (_label, fail) => {
    const s = scripted([fail, OK]);
    const result = await withComputeRetry(s.client, { delayMs: 10, sleep: s.sleep }).requestCurrent([]);
    expect(result).toEqual(fail);
    expect(s.calls.length).toBe(1);
    expect(s.sleeps).toEqual([]);
  });

  it('ping은 그대로 위임', async () => {
    const s = scripted([OK]);
    await expect(withComputeRetry(s.client, { delayMs: 10, sleep: s.sleep }).ping()).resolves.toBe(true);
  });
});
