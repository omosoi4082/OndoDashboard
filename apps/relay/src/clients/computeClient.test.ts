// docs/03-upstream-apis.md 4.1 "POST /v1/forecast" 요청 바디: inputs + 최상위
// forecast_from·forecast_issued_at(docs/02-relay-api.md 6장). buildComputeRequestBody(current)는
// 바디에 그 두 필드가 없어야 한다(혼동 방지 — forecast 전용 필드).
import { describe, expect, it } from 'vitest';
import { buildComputeRequestBody, buildForecastRequestBody, type ComputeRequestInput } from './computeClient.js';

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
