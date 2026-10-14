// docs/03-upstream-apis.md 4.1 "POST /v1/forecast" 요청 바디: inputs + 최상위
// forecast_from·forecast_issued_at(docs/02-relay-api.md 6장). buildComputeRequestBody(current)는
// 바디에 그 두 필드가 없어야 한다(혼동 방지 — forecast 전용 필드).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildComputeRequestBody,
  buildForecastRequestBody,
  createHttpComputeClient,
  type ComputeRequestInput,
} from './computeClient.js';

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
  const OPTS = { baseUrl: 'http://compute.test', apiKey: '', apiKeyHeader: 'X-API-Key', timeoutMs: 1000 };

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
