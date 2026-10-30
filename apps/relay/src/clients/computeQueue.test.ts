// 연산 서버 요청 직렬화(2026-10-30 온도 측 요청): 두 화면이 동시에 열려도 중계 서버는
// 한 건씩만 보낸다. 연산 서버가 계산 중에 받은 요청은 503 BUSY로 돌려보내므로(10/13 D-4),
// 겹치지 않게 하는 쪽이 재시도보다 먼저다.
import { describe, expect, it, vi } from 'vitest';
import type { ComputeClient, ComputeOkResult, ComputeResult } from './computeClient.js';
import { withComputeQueue } from './computeQueue.js';

const OK: ComputeOkResult = { ok: true, requestId: 'r', modelVersion: 'v', frames: [] };
const EXTRA = { forecastFrom: '2026-10-05T15:25:00', forecastIssuedAt: '2026-10-05T14:00:00' };

interface Fake {
  client: ComputeClient;
  /** 호출 시작·종료 순서. 'current+'는 시작, 'current-'는 종료. */
  log: string[];
  /** 진행 중인 호출을 끝낸다(먼저 들어온 순서). 호출이 시작될 때까지 기다린다. */
  release: () => Promise<void>;
  inFlightMax: number;
}

/** 다음 틱까지 기다린다(줄 세우기는 마이크로태스크로 이어 붙으므로 실제 틱이 필요하다). */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** 호출을 붙잡아 두는 가짜 클라이언트 — release()를 부를 때까지 끝나지 않는다. */
function fake(result: () => Promise<ComputeResult> | ComputeResult = () => OK): Fake {
  const log: string[] = [];
  const waiting: Array<() => void> = [];
  let inFlight = 0;
  const state = { inFlightMax: 0 };
  const hold = async (kind: string): Promise<ComputeResult> => {
    log.push(`${kind}+`);
    inFlight += 1;
    state.inFlightMax = Math.max(state.inFlightMax, inFlight);
    await new Promise<void>((resolve) => waiting.push(resolve));
    inFlight -= 1;
    log.push(`${kind}-`);
    return result();
  };
  return {
    client: {
      ping: () => Promise.resolve(true),
      requestCurrent: () => hold('current'),
      requestForecast: () => hold('forecast'),
    },
    log,
    release: async () => {
      for (let i = 0; i < 100 && waiting.length === 0; i += 1) await tick();
      const next = waiting.shift();
      if (!next) throw new Error('진행 중인 호출이 없다');
      next();
    },
    get inFlightMax() {
      return state.inFlightMax;
    },
  };
}

describe('withComputeQueue', () => {
  it('동시에 들어온 두 요청을 한 건씩 보낸다', async () => {
    const f = fake();
    const queued = withComputeQueue(f.client);
    const first = queued.requestCurrent([]);
    const second = queued.requestForecast([], EXTRA);

    // 둘째는 아직 보내지 않았다 — 첫째가 끝나기를 기다린다.
    await tick();
    expect(f.log).toEqual(['current+']);

    await f.release();
    await expect(first).resolves.toEqual(OK);
    await f.release();
    await expect(second).resolves.toEqual(OK);

    expect(f.log).toEqual(['current+', 'current-', 'forecast+', 'forecast-']);
    expect(f.inFlightMax).toBe(1);
  });

  it('앞 요청이 실패해도 뒤 요청은 보낸다', async () => {
    let n = 0;
    const f = fake(() => {
      n += 1;
      if (n === 1) throw new Error('연결 끊김');
      return OK;
    });
    const queued = withComputeQueue(f.client);
    const first = queued.requestCurrent([]);
    const second = queued.requestCurrent([]);

    await f.release();
    await expect(first).rejects.toThrow('연결 끊김');
    await f.release();
    await expect(second).resolves.toEqual(OK);
    expect(f.inFlightMax).toBe(1);
  });

  it('대기가 생기면 경고를 남긴다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const f = fake();
    const queued = withComputeQueue(f.client);
    const first = queued.requestCurrent([]);
    const second = queued.requestForecast([], EXTRA);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('예측 요청 대기 1건');

    await f.release();
    await first;
    await f.release();
    await second;
    warn.mockRestore();
  });

  it('대기 건이 끝나면 다음 요청은 바로 나간다(대기 수가 쌓이지 않는다)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const f = fake();
    const queued = withComputeQueue(f.client);
    const first = queued.requestCurrent([]);
    await f.release();
    await first;

    const second = queued.requestCurrent([]);
    await f.release();
    await second;
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('ping(상태 확인)은 줄을 세우지 않는다 — 계산 중에도 바로 답해야 한다', async () => {
    const f = fake();
    const queued = withComputeQueue(f.client);
    const busy = queued.requestCurrent([]);
    await expect(queued.ping()).resolves.toBe(true);
    await f.release();
    await busy;
  });
});
