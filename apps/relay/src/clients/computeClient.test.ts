// docs/03-upstream-apis.md 4.1 "POST /v1/forecast" 요청 바디: inputs + 최상위
// forecast_from·forecast_issued_at(docs/02-relay-api.md 6장). buildComputeRequestBody(current)는
// 바디에 그 두 필드가 없어야 한다(혼동 방지 — forecast 전용 필드).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildComputeRequestBody,
  buildForecastRequestBody,
  COMPUTE_FORBIDDEN_MESSAGE,
  COMPUTE_UNREACHABLE_MESSAGE,
  createHttpComputeClient,
  parseComputeResponse,
  type ComputeRequestInput,
} from './computeClient.js';
import { shouldRetryCompute } from './computeRetry.js';

const OPTS = { baseUrl: 'http://compute.test', apiKey: '', apiKeyHeader: 'X-API-Key', timeoutMs: 1000, pingTimeoutMs: 1000 };

const INPUTS: ComputeRequestInput[] = [{ time: '2026-10-05T15:20:00', T_out: 21.5, RH_out: 65, fan_pct: 60 }];

describe('buildComputeRequestBody', () => {
  it('request_id + inputs만 담는다(forecast 전용 필드 없음)', () => {
    const body = buildComputeRequestBody(INPUTS);
    expect(body.inputs).toEqual(INPUTS);
    expect(typeof body.request_id).toBe('string');
    expect(body).not.toHaveProperty('forecast_from');
    expect(body).not.toHaveProperty('forecast_issued_at');
  });
});

describe('buildForecastRequestBody', () => {
  it('forecast_from·forecast_issued_at을 최상위에 담는다(타임존 없는 문자열)', () => {
    const body = buildForecastRequestBody(INPUTS, {
      forecastFrom: '2026-10-05T15:25:00',
      forecastIssuedAt: '2026-10-05T14:00:00',
    });
    expect(body.inputs).toEqual(INPUTS);
    expect(body.forecast_from).toBe('2026-10-05T15:25:00');
    expect(body.forecast_issued_at).toBe('2026-10-05T14:00:00');
    expect(typeof body.request_id).toBe('string');
  });
});

// COMPUTE_MODE=http 전환 대비: 온도 측이 준 v3 응답 파일(실제 연산 서버가 돌려줄 형식)을
// HttpComputeClient가 그대로 받아들이는지 확인한다. mock 모드는 같은 파일을 읽으므로, 이 테스트가
// 통과하면 연산 서버를 붙였을 때 응답 파싱 단계에서 오류가 나지 않는다.
describe('createHttpComputeClient — v3 응답 파일 수용', () => {
  const mockDir = fileURLToPath(new URL('../../../../mock/', import.meta.url));
  
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetchWithFile(fileName: string): { calls: { url: string; body: unknown }[] } {
    const text = readFileSync(`${mockDir}${fileName}`, 'utf-8');
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) as unknown });
      return new Response(text, { status: 200 });
    });
    return { calls };
  }

  it('current: sample_response_current.json을 오류 없이 파싱하고 range·geometryId를 넘긴다', async () => {
    const { calls } = stubFetchWithFile('sample_response_current.json');
    const result = await createHttpComputeClient(OPTS).requestCurrent(INPUTS);
    expect(calls[0]?.url).toBe('http://compute.test/v1/current');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frames.length).toBe(1);
    expect(result.range).toBeDefined();
    expect(result.geometryId).toBe('pig-nh-v1');
  });

  it('forecast: sample_response_forecast.json을 오류 없이 파싱한다(145프레임)', async () => {
    const { calls } = stubFetchWithFile('sample_response_forecast.json');
    const result = await createHttpComputeClient(OPTS).requestForecast(INPUTS, {
      forecastFrom: '2026-10-05T15:25:00',
      forecastIssuedAt: '2026-10-05T14:00:00',
    });
    expect(calls[0]?.url).toBe('http://compute.test/v1/forecast');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frames.length).toBe(145);
    expect(result.range).toBeDefined();
    expect(result.geometryId).toBe('pig-nh-v1');
  });
});

// D-4(2026-10-13): 오류 본문 { request_id?, status: "error", code, field?, message }.
describe('parseComputeResponse — 오류 본문(D-4)', () => {
  it('BAD_REQUEST + field → upstreamCode·field 보존, 메시지에 항목명 포함', () => {
    const r = parseComputeResponse({ request_id: 'x', status: 'error', code: 'BAD_REQUEST', field: 'inputs[3].T_out', message: 'null not allowed' });
    expect(r).toEqual({
      ok: false,
      code: 'UPSTREAM_ERROR',
      message: '예측 서버 요청 거부: null not allowed (항목: inputs[3].T_out)',
      upstreamCode: 'BAD_REQUEST',
      field: 'inputs[3].T_out',
    });
  });

  it('BAD_REQUEST, field 없음 → 항목명 없이', () => {
    const r = parseComputeResponse({ status: 'error', code: 'BAD_REQUEST', message: 'bad' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toBe('예측 서버 요청 거부: bad');
    expect(r.field).toBeUndefined();
  });

  it.each(['SERVER', 'BUSY'] as const)('%s → upstreamCode 보존, 메시지는 원문', (code) => {
    const r = parseComputeResponse({ status: 'error', code, message: 'm' });
    expect(r).toEqual({ ok: false, code: 'UPSTREAM_ERROR', message: 'm', upstreamCode: code });
  });

  it('code 없음(구버전 목업) → upstreamCode 없이 기존과 같다', () => {
    const r = parseComputeResponse({ request_id: 'x', status: 'error', message: 'old' });
    expect(r).toEqual({ ok: false, code: 'UPSTREAM_ERROR', message: 'old' });
  });

  it('모르는 code → 형식 오류가 아니라 code 없음으로 취급', () => {
    const r = parseComputeResponse({ status: 'error', code: 'WHATEVER', message: 'm' });
    expect(r).toEqual({ ok: false, code: 'UPSTREAM_ERROR', message: 'm' });
  });
});

describe('createHttpComputeClient — 오류·연결 실패', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('HTTP 503 + SERVER 본문 → upstreamCode SERVER', async () => {
    vi.stubGlobal('fetch', async () =>
      new Response(JSON.stringify({ status: 'error', code: 'SERVER', message: 'oom' }), { status: 503 }),
    );
    const r = await createHttpComputeClient(OPTS).requestCurrent(INPUTS);
    expect(r).toEqual({ ok: false, code: 'UPSTREAM_ERROR', message: 'oom', upstreamCode: 'SERVER' });
  });

  // 안내 문서 v1.3.2 5장: 403은 허용 목록에 없는 IP에서 접속한 경우다.
  it('HTTP 403 → IP 허용 목록 안내 문구, 재시도 대상 아님', async () => {
    vi.stubGlobal('fetch', async () =>
      new Response(JSON.stringify({ status: 'error', code: 'FORBIDDEN', message: 'not allowed' }), { status: 403 }),
    );
    const r = await createHttpComputeClient(OPTS).requestCurrent(INPUTS);
    expect(r).toEqual({ ok: false, code: 'UPSTREAM_ERROR', message: COMPUTE_FORBIDDEN_MESSAGE });
    expect(shouldRetryCompute(r)).toBe(false);
  });

  // 안내 문서 v1.3.2 1장: charset 명시 + gzip 요청(예측 응답 약 6 MB → 0.4 MB).
  it('요청 헤더에 charset=utf-8과 Accept-Encoding: gzip을 붙인다', async () => {
    let sent: Record<string, string> = {};
    vi.stubGlobal('fetch', async (_url: string, init: { headers: Record<string, string> }) => {
      sent = init.headers;
      return new Response('{}', { status: 500 });
    });
    await createHttpComputeClient(OPTS).requestCurrent(INPUTS);
    expect(sent['Content-Type']).toBe('application/json; charset=utf-8');
    expect(sent['Accept-Encoding']).toBe('gzip');
  });

  it('HTTP 500 + JSON 아닌 본문 → code 없는 UPSTREAM_ERROR', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html>', { status: 500 }));
    const r = await createHttpComputeClient(OPTS).requestCurrent(INPUTS);
    expect(r).toEqual({ ok: false, code: 'UPSTREAM_ERROR', message: '연산 서버 HTTP 500' });
  });

  it('연결 실패 → UPSTREAM_UNREACHABLE + "예측 서버 연결 안 됨"', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('fetch failed');
    });
    const r = await createHttpComputeClient(OPTS).requestCurrent(INPUTS);
    expect(r).toEqual({ ok: false, code: 'UPSTREAM_UNREACHABLE', message: COMPUTE_UNREACHABLE_MESSAGE });
  });

  it('타임아웃 → UPSTREAM_TIMEOUT + "예측 서버 연결 안 됨"', async () => {
    vi.stubGlobal('fetch', (_url: string, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
        });
      }),
    );
    const r = await createHttpComputeClient({ ...OPTS, timeoutMs: 10 }).requestCurrent(INPUTS);
    expect(r).toEqual({ ok: false, code: 'UPSTREAM_TIMEOUT', message: COMPUTE_UNREACHABLE_MESSAGE });
  });
});

// D-5(2026-10-13): GET /v1/health, HTTP 2xx면 살아 있음.
describe('createHttpComputeClient.ping', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GET /v1/health 200 → true, API 키가 있으면 헤더 포함', async () => {
    const calls: { url: string; method: string | undefined; headers: Record<string, string> }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: { method?: string; headers: Record<string, string> }) => {
      calls.push({ url, method: init.method, headers: init.headers });
      return new Response('{"status":"ok"}', { status: 200 });
    });
    const ok = await createHttpComputeClient({ ...OPTS, apiKey: 'k' }).ping();
    expect(ok).toBe(true);
    expect(calls[0]).toEqual({ url: 'http://compute.test/v1/health', method: 'GET', headers: { 'X-API-Key': 'k' } });
  });

  it('HTTP 503 → false', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 503 }));
    await expect(createHttpComputeClient(OPTS).ping()).resolves.toBe(false);
  });

  it('연결 실패 → false(예외 없음)', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('fetch failed');
    });
    await expect(createHttpComputeClient(OPTS).ping()).resolves.toBe(false);
  });
});
