import { describe, expect, it } from 'vitest';
import type { Geometry } from '@ondo/shared';
import { buildCurrentDetail, buildForecastDetail } from './detailTransform.js';
import type { ComputeFrame } from '../clients/computeClient.js';

const GEOMETRY: Geometry = {
  geometryId: 'test-geometry',
  room: { size: [4, 4, 2], inlets: [{ x: 2, y: 1, z: 2, w: 0.3, l: 0.7 }], outlet: { wall: 'y=0', x: 2, z: 1.5, d: 0.4 } },
  points: [
    { id: 0, x: 0.5, y: 0.5, z: 0.5 },
    { id: 1, x: 3.5, y: 3.5, z: 1.5 },
  ],
  grid: { origin: [0, 0, 0], spacing: [1, 1, 1], size: [2, 2, 2] }, // 8개
  flowGrid: { origin: [0.5, 0.5, 0.5], spacing: [2, 2, 1], size: [1, 1, 1] }, // 1개
};

function validFrame(): ComputeFrame {
  return {
    time: '2026-10-05T15:20:00',
    points: {
      temp: [20, 25],
      rh: [60, 65],
      flow: [
        [0.1, 0, 0, 0.1],
        [0.2, 0, 0, 0.2],
      ],
    },
    grid: { temp: new Array(8).fill(22), rh: new Array(8).fill(62) },
    flow: [[0.1, 0.1, 0, 0.14]],
    outdoor: { T_out: 21.5, RH_out: 65, fan_pct: 60 },
    summary: { T_mean: 22, T_min: 20, T_max: 25, T_west: 20, T_east: 25, RH_mean: 62, V_mean: 0.14, V_max: 0.2 },
    quality: { in_range: true, warnings: [] },
  };
}

describe('buildCurrentDetail', () => {
  it('정상 변환: +09:00·offsetMin·geometryId·model_version·range를 채운다', () => {
    const result = buildCurrentDetail({ computeFrames: [validFrame()], modelVersion: 'mock-v1', geometry: GEOMETRY });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.mode).toBe('current');
    expect(result.data.geometryId).toBe('test-geometry');
    expect(result.data.model_version).toBe('mock-v1');
    expect(result.data.intervalMin).toBe(10);
    expect(result.data.baseAt).toBe('2026-10-05T15:20:00+09:00');
    expect(result.data.frames).toHaveLength(1);
    expect(result.data.frames[0]?.offsetMin).toBe(0);
    expect(result.data.frames[0]?.time).toBe('2026-10-05T15:20:00+09:00');
    expect(result.data.range.temp).toEqual({ min: 20, max: 25 });
    expect(result.data.range.rh).toEqual({ min: 60, max: 65 });
    expect(result.data.range.flow).toEqual({ min: 0.1, max: 0.2 });
  });

  it('값 자체는 바꾸지 않는다(복사만)', () => {
    const frame = validFrame();
    const result = buildCurrentDetail({ computeFrames: [frame], modelVersion: 'mock-v1', geometry: GEOMETRY });
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.frames[0]?.points.temp).toEqual(frame.points.temp);
    expect(result.data.frames[0]?.outdoor).toEqual(frame.outdoor);
    expect(result.data.frames[0]?.summary).toEqual(frame.summary);
  });

  it('프레임이 0개면 에러', () => {
    const result = buildCurrentDetail({ computeFrames: [], modelVersion: 'mock-v1', geometry: GEOMETRY });
    expect(result.ok).toBe(false);
  });

  it('프레임이 2개 이상이면(current 기대와 다름) 에러', () => {
    const result = buildCurrentDetail({
      computeFrames: [validFrame(), validFrame()],
      modelVersion: 'mock-v1',
      geometry: GEOMETRY,
    });
    expect(result.ok).toBe(false);
  });

  it('points 배열 개수가 Geometry와 다르면 에러', () => {
    const frame = validFrame();
    frame.points.temp = [20]; // 2개 기대, 1개만
    const result = buildCurrentDetail({ computeFrames: [frame], modelVersion: 'mock-v1', geometry: GEOMETRY });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('points');
  });

  it('grid 배열 개수가 Geometry와 다르면 에러', () => {
    const frame = validFrame();
    frame.grid.temp = new Array(5).fill(20); // 8개 기대
    const result = buildCurrentDetail({ computeFrames: [frame], modelVersion: 'mock-v1', geometry: GEOMETRY });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('grid');
  });

  it('flow 배열 개수가 Geometry와 다르면 에러', () => {
    const frame = validFrame();
    frame.flow = []; // 1개 기대
    const result = buildCurrentDetail({ computeFrames: [frame], modelVersion: 'mock-v1', geometry: GEOMETRY });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('flow');
  });
});

function forecastFrames(count: number): ComputeFrame[] {
  const frames: ComputeFrame[] = [];
  for (let i = 0; i < count; i += 1) {
    const frame = validFrame();
    frame.time = `2026-10-05T${String(15 + Math.floor(i / 6)).padStart(2, '0')}:${String((i % 6) * 10).padStart(2, '0')}:00`;
    // 프레임마다 값이 조금씩 달라지게(range가 전체 프레임 기준인지 검증하려고).
    frame.points.temp = [20 + i * 0.1, 25 + i * 0.1];
    frame.grid.temp = new Array(8).fill(22 + i * 0.1);
    frames.push(frame);
  }
  return frames;
}

describe('buildForecastDetail', () => {
  it('정상 변환: 145개 프레임, offsetMin=index*10, baseAt=첫 프레임 시각', () => {
    const result = buildForecastDetail({ computeFrames: forecastFrames(145), modelVersion: 'mock-v1', geometry: GEOMETRY });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.mode).toBe('forecast');
    expect(result.data.frames).toHaveLength(145);
    expect(result.data.frames[0]?.offsetMin).toBe(0);
    expect(result.data.frames[1]?.offsetMin).toBe(10);
    expect(result.data.frames[144]?.offsetMin).toBe(1440);
    expect(result.data.baseAt).toBe(result.data.frames[0]?.time);
  });

  it('range는 전체 프레임 기준 min/max(마지막 프레임의 더 높은 값까지 포함)', () => {
    const result = buildForecastDetail({ computeFrames: forecastFrames(145), modelVersion: 'mock-v1', geometry: GEOMETRY });
    if (!result.ok) throw new Error('expected ok');
    // 프레임 0: points.temp=[20,25], 프레임 144: points.temp=[20+14.4, 25+14.4]
    expect(result.data.range.temp.min).toBeCloseTo(20, 5);
    expect(result.data.range.temp.max).toBeCloseTo(25 + 144 * 0.1, 5);
  });

  it('프레임 수가 145개가 아니면 에러', () => {
    const result = buildForecastDetail({ computeFrames: forecastFrames(10), modelVersion: 'mock-v1', geometry: GEOMETRY });
    expect(result.ok).toBe(false);
  });

  it('중간 프레임의 배열 개수가 Geometry와 다르면 에러', () => {
    const frames = forecastFrames(145);
    const bad = frames[50];
    if (bad) bad.grid.temp = [1, 2, 3]; // 8개 기대
    const result = buildForecastDetail({ computeFrames: frames, modelVersion: 'mock-v1', geometry: GEOMETRY });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('grid');
  });
});

// v3(2026-10-13)부터 연산 서버 응답에 range·geometryId가 들어온다.
describe('responseRange / responseGeometryId (v3)', () => {
  const RESPONSE_RANGE = {
    temp: { min: 10, max: 40 },
    rh: { min: 30, max: 90 },
    // flow.max는 급기구 극값을 뺀 95퍼센타일이라, 실제 최댓값(0.2)보다 작을 수 있다.
    flow: { min: 0, max: 0.15 },
  };

  it('current: 응답 range를 그대로 쓰고 직접 계산하지 않는다', () => {
    const result = buildCurrentDetail({
      computeFrames: [validFrame()],
      modelVersion: 'mock-v1',
      geometry: GEOMETRY,
      responseRange: RESPONSE_RANGE,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.range).toEqual(RESPONSE_RANGE);
    // 프레임에서 계산했다면 temp는 20~25, flow max는 0.2가 됐을 것이다.
    expect(result.data.range.temp).not.toEqual({ min: 20, max: 25 });
    expect(result.data.range.flow.max).toBe(0.15);
  });

  it('current: 응답 range가 없으면 기존처럼 프레임에서 계산한다(폴백)', () => {
    const result = buildCurrentDetail({ computeFrames: [validFrame()], modelVersion: 'mock-v1', geometry: GEOMETRY });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.range.temp).toEqual({ min: 20, max: 25 });
  });

  it('forecast: 응답 range를 그대로 쓴다', () => {
    const result = buildForecastDetail({
      computeFrames: forecastFrames(145),
      modelVersion: 'mock-v1',
      geometry: GEOMETRY,
      responseRange: RESPONSE_RANGE,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.range).toEqual(RESPONSE_RANGE);
  });

  it('geometryId가 일치하면 통과한다', () => {
    const result = buildCurrentDetail({
      computeFrames: [validFrame()],
      modelVersion: 'mock-v1',
      geometry: GEOMETRY,
      responseGeometryId: 'test-geometry',
    });
    expect(result.ok).toBe(true);
  });

  it('geometryId가 다르면 에러(배열 순서를 신뢰할 수 없다)', () => {
    const result = buildCurrentDetail({
      computeFrames: [validFrame()],
      modelVersion: 'mock-v1',
      geometry: GEOMETRY,
      responseGeometryId: 'pig-nh-v2',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('geometryId');
      expect(result.message).toContain('pig-nh-v2');
    }
  });

  it('forecast도 geometryId 불일치를 막는다', () => {
    const result = buildForecastDetail({
      computeFrames: forecastFrames(145),
      modelVersion: 'mock-v1',
      geometry: GEOMETRY,
      responseGeometryId: 'pig-nh-v2',
    });
    expect(result.ok).toBe(false);
  });

  it('geometryId가 없으면 검사하지 않는다(구버전 목업·합성 생성기)', () => {
    const result = buildCurrentDetail({ computeFrames: [validFrame()], modelVersion: 'mock-v1', geometry: GEOMETRY });
    expect(result.ok).toBe(true);
  });
});
