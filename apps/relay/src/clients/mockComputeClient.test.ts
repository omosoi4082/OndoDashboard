// docs/03-upstream-apis.md 4.3 Mock. 두 경로를 모두 검증한다:
//  ① 온도 측 응답 파일을 읽는 경로(1순위) — 값은 파일 그대로, 시각만 요청 기준으로 재배치
//  ② 파일이 없을 때의 합성 생성기 폴백(2순위) — 325건 입력 중 마지막 실측(index 36)부터
//     10분 간격(5분 입력 2개 간격)으로 145개 프레임
import { describe, expect, it, vi } from 'vitest';
import type { Geometry } from '@ondo/shared';
import { createMockComputeClient, type ResponseFileLoader } from './mockComputeClient.js';
import type { ComputeFrame, ComputeOkResult, ComputeRequestInput } from './computeClient.js';

const GEOMETRY: Geometry = {
  geometryId: 'test-geometry',
  room: { size: [4, 4, 2], inlets: [{ x: 2, y: 1, z: 2, w: 0.3, l: 0.7 }], outlet: { wall: 'y=0', x: 2, z: 1.5, d: 0.4 } },
  points: [{ id: 0, x: 0.5, y: 0.5, z: 0.5 }],
  grid: { origin: [0, 0, 0], spacing: [1, 1, 1], size: [2, 2, 2] },
  flowGrid: { origin: [0.5, 0.5, 0.5], spacing: [2, 2, 1], size: [1, 1, 1] },
};

function makeInputs(count: number): ComputeRequestInput[] {
  const inputs: ComputeRequestInput[] = [];
  for (let i = 0; i < count; i += 1) {
    inputs.push({ time: `2026-10-05T12:${String(i).padStart(2, '0')}:00`, T_out: 20 + i * 0.01, RH_out: 65, fan_pct: 50 });
  }
  return inputs;
}

const EXTRA = { forecastFrom: '2026-10-05T15:25:00', forecastIssuedAt: '2026-10-05T14:00:00' };

/** 파일을 못 읽는 상황 — 합성 생성기 폴백을 강제한다. */
const NO_FILE: ResponseFileLoader = () => ({ ok: false, message: '테스트: 파일 없음' });

// 온도 측 응답 파일을 흉내 낸 것. 시각은 파일처럼 과거(2026-10-05)로 고정해 둔다.
function fileFrame(timeIso: string, temp: number): ComputeFrame {
  return {
    time: timeIso,
    points: { temp: [temp], rh: [60], flow: [[0.1, 0, 0, 0.1]] },
    grid: { temp: new Array(8).fill(temp), rh: new Array(8).fill(60) },
    flow: [[0.1, 0.1, 0, 0.14]],
    outdoor: { T_out: 26.47, RH_out: 74.8, fan_pct: 60.5 },
    summary: { T_mean: temp, T_min: temp, T_max: temp, T_west: temp, T_east: temp, RH_mean: 60, V_mean: 0.14, V_max: 0.2 },
    quality: { in_range: true, warnings: [] },
  };
}

function fileResult(frameCount: number): ComputeOkResult {
  const frames: ComputeFrame[] = [];
  for (let i = 0; i < frameCount; i += 1) {
    // 파일 자체도 프레임 0 = 마지막 실측, 10분 간격 규칙을 따른다(15:20 시작).
    const minute = 20 + i * 10;
    const hh = 15 + Math.floor(minute / 60);
    const mm = minute % 60;
    frames.push(fileFrame(`2026-10-05T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`, 28 + i * 0.01));
  }
  return {
    ok: true,
    requestId: '3f2b8c1e-1111-4000-8000-000000000001',
    modelVersion: 'v9_1_2',
    frames,
    range: { temp: { min: 10, max: 40 }, rh: { min: 30, max: 90 }, flow: { min: 0, max: 0.15 } },
    geometryId: 'pig-nh-v1',
  };
}

describe('createMockComputeClient — 응답 파일 경로(1순위)', () => {
  it('current: 파일 값·range·geometryId를 그대로 돌려준다', async () => {
    const client = createMockComputeClient({ geometry: GEOMETRY, loadCurrentFile: () => ({ ok: true, data: fileResult(1) }) });
    const result = await client.requestCurrent(makeInputs(37));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.modelVersion).toBe('v9_1_2');
    expect(result.geometryId).toBe('pig-nh-v1');
    expect(result.range).toEqual({ temp: { min: 10, max: 40 }, rh: { min: 30, max: 90 }, flow: { min: 0, max: 0.15 } });
    // 값은 파일 그대로(합성 생성기 값이 아니다).
    expect(result.frames[0]?.summary.T_mean).toBe(28);
    expect(result.frames[0]?.outdoor.T_out).toBe(26.47);
  });

  it('current: 시각만 마지막 입력 시각으로 바뀐다', async () => {
    const client = createMockComputeClient({ geometry: GEOMETRY, loadCurrentFile: () => ({ ok: true, data: fileResult(1) }) });
    const inputs = makeInputs(37);
    const result = await client.requestCurrent(inputs);
    if (!result.ok) throw new Error('expected ok');
    // 파일의 2026-10-05T15:20:00이 아니라 요청의 마지막 입력 시각이 된다.
    expect(result.frames[0]?.time).toBe(inputs[36]?.time);
    expect(result.frames[0]?.time).not.toBe('2026-10-05T15:20:00');
  });

  it('forecast: 145프레임이 마지막 실측 시각부터 10분 간격으로 다시 깔린다', async () => {
    const client = createMockComputeClient({ geometry: GEOMETRY, loadForecastFile: () => ({ ok: true, data: fileResult(145) }) });
    const inputs = makeInputs(325);
    const result = await client.requestForecast(inputs, EXTRA);
    if (!result.ok) throw new Error('expected ok');
    expect(result.frames).toHaveLength(145);
    expect(result.frames[0]?.time).toBe(inputs[36]?.time); // 12:36
    expect(result.frames[1]?.time).toBe('2026-10-05T12:46:00'); // +10분
    expect(result.frames[6]?.time).toBe('2026-10-05T13:36:00'); // +1시간
    // 마지막 프레임은 프레임 0 + 1,440분(24시간) → 다음 날로 넘어간다.
    expect(result.frames[144]?.time).toBe('2026-10-06T12:36:00');
  });

  it('forecast: 값은 파일 그대로 유지된다(시각만 바뀐다)', async () => {
    const client = createMockComputeClient({ geometry: GEOMETRY, loadForecastFile: () => ({ ok: true, data: fileResult(145) }) });
    const result = await client.requestForecast(makeInputs(325), EXTRA);
    if (!result.ok) throw new Error('expected ok');
    expect(result.frames[10]?.summary.T_mean).toBeCloseTo(28 + 10 * 0.01, 10);
    expect(result.frames[10]?.points.temp[0]).toBeCloseTo(28 + 10 * 0.01, 10);
  });

  it('forecast: 입력이 부족하면 파일이 있어도 에러(연산 서버와 같은 판정)', async () => {
    const client = createMockComputeClient({ geometry: GEOMETRY, loadForecastFile: () => ({ ok: true, data: fileResult(145) }) });
    const result = await client.requestForecast(makeInputs(10), EXTRA);
    expect(result.ok).toBe(false);
  });

  it('결정적이다(같은 입력이면 같은 출력)', async () => {
    const client = createMockComputeClient({ geometry: GEOMETRY, loadForecastFile: () => ({ ok: true, data: fileResult(145) }) });
    const inputs = makeInputs(325);
    const a = await client.requestForecast(inputs, EXTRA);
    const b = await client.requestForecast(inputs, EXTRA);
    expect(a).toEqual(b);
  });
});

describe('createMockComputeClient — 합성 생성기 폴백(2순위)', () => {
  it('current: 파일이 없으면 합성 프레임 1개를 만든다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const client = createMockComputeClient({ geometry: GEOMETRY, loadCurrentFile: NO_FILE });
    const inputs = makeInputs(37);
    const result = await client.requestCurrent(inputs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.modelVersion).toBe('mock-v1');
    expect(result.range).toBeUndefined(); // 합성에는 range가 없다 → relay가 계산한다
    expect(result.frames[0]?.time).toBe(inputs[36]?.time);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('폴백 경고는 모드별로 한 번만 찍는다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const client = createMockComputeClient({ geometry: GEOMETRY, loadCurrentFile: NO_FILE });
    await client.requestCurrent(makeInputs(37));
    await client.requestCurrent(makeInputs(37));
    await client.requestCurrent(makeInputs(37));
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('forecast: 325건 입력이면 145개 프레임을 생성한다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const client = createMockComputeClient({ geometry: GEOMETRY, loadForecastFile: NO_FILE });
    const result = await client.requestForecast(makeInputs(325), EXTRA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frames).toHaveLength(145);
    warn.mockRestore();
  });

  it('forecast: 첫 프레임은 37번째 입력(index 36)을 쓴다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const client = createMockComputeClient({ geometry: GEOMETRY, loadForecastFile: NO_FILE });
    const inputs = makeInputs(325);
    const result = await client.requestForecast(inputs, EXTRA);
    if (!result.ok) throw new Error('expected ok');
    expect(result.frames[0]?.time).toBe(inputs[36]?.time);
    expect(result.frames[1]?.time).toBe(inputs[38]?.time); // 10분 간격 = 5분 입력 2칸
    expect(result.frames[144]?.time).toBe(inputs[36 + 144 * 2]?.time);
    warn.mockRestore();
  });

  it('forecast: 입력이 부족하면(325건 미달) 에러', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const client = createMockComputeClient({ geometry: GEOMETRY, loadForecastFile: NO_FILE });
    const result = await client.requestForecast(makeInputs(100), EXTRA);
    expect(result.ok).toBe(false);
    warn.mockRestore();
  });
});
