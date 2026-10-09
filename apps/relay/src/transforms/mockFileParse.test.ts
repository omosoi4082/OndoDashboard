import { describe, expect, it } from 'vitest';
import { parseControlMockFile, parseExpertMockFile } from './mockFileParse.js';

function makeFrame(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    time: '2026-10-05T15:20:00',
    points: { temp: [1], rh: [2], flow: [[0, 0, 0, 0]] },
    grid: { temp: [1], rh: [2] },
    flow: [[0, 0, 0, 0]],
    outdoor: { T_out: 21.5, RH_out: 65, fan_pct: 60 },
    summary: { T_mean: 27, T_min: 20, T_max: 30, T_west: 27, T_east: 27, RH_mean: 65, V_mean: 0.1, V_max: 0.2 },
    quality: { in_range: true, warnings: [] },
    ...overrides,
  };
}

describe('parseExpertMockFile', () => {
  it('request_id·status·mock·scenario·guide·최상위 input 등 여분 필드를 무시하고 frames·modelVersion만 뽑아낸다', () => {
    const raw = {
      request_id: 'mock-expert-extreme-heat',
      status: 'ok',
      model_version: 'v9_1_2',
      mock: true,
      mock_version: 'v2 (2026-10-08)',
      note: '형식 확인용',
      mode: 'expert',
      scenario: '극한 환경',
      guide: { frames: '설명' },
      input: { request_id: 'x', forecast_issued_at: null, forecast_from: '2026-10-05T15:25:00', inputs: [] },
      frames: [makeFrame()],
    };
    const result = parseExpertMockFile(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.modelVersion).toBe('v9_1_2');
      expect(result.data.frames).toHaveLength(1);
      expect(result.data.frames[0]).not.toHaveProperty('offsetMin');
    }
  });

  it('frames가 없으면(형식 오류) ok:false', () => {
    const result = parseExpertMockFile({ model_version: 'v1' });
    expect(result.ok).toBe(false);
  });
});

describe('parseControlMockFile', () => {
  const rawControl = {
    baseline_fan_pct: [50, 60],
    optimized_fan_pct: [40, 45],
    baseline_T_mean: [27, 28],
    optimized_T_mean: [27.5, 28.5],
    energy_kwh: { baseline: 5.86, optimized: 3.62 },
    saving_pct: 38.2,
    T_max: { baseline: 29.6, optimized: 29.97 },
    constraint: { T_mean_max: 30 },
    fan_rated_kw: 0.75,
    power_model: 'P[kW] = fan_rated_kw × (0.1 + 0.9 × (fan_pct/100)^2)',
  };

  it('snake_case control 블록을 packages/shared ControlBlock(camelCase)로 매핑한다', () => {
    const raw = {
      request_id: 'mock-control-energy',
      status: 'ok',
      model_version: 'v9_1_2',
      mode: 'control',
      target: 'energy',
      control: rawControl,
      frames: [makeFrame()],
    };
    const result = parseControlMockFile(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.control).toEqual({
        baselineFanPct: [50, 60],
        optimizedFanPct: [40, 45],
        baselineTMean: [27, 28],
        optimizedTMean: [27.5, 28.5],
        energyKwh: { baseline: 5.86, optimized: 3.62 },
        savingPct: 38.2,
        tMax: { baseline: 29.6, optimized: 29.97 },
        constraint: { tMeanMax: 30 },
      });
      // fan_rated_kw·power_model은 ControlBlock에 없으므로 결과에 남지 않는다.
      expect(result.data.control).not.toHaveProperty('fan_rated_kw');
      expect(result.data.control).not.toHaveProperty('power_model');
    }
  });

  it('control 블록이 없으면 ok:false', () => {
    const result = parseControlMockFile({ model_version: 'v1', frames: [makeFrame()] });
    expect(result.ok).toBe(false);
  });
});
