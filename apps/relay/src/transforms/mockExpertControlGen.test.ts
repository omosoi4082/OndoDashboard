import { describe, expect, it } from 'vitest';
import type { Geometry } from '@ondo/shared';
import {
  EXPERT_CONTROL_FRAME_COUNT,
  buildControlDetailMock,
  buildExpertDetailMock,
  dayCycleOutdoor,
  fanBellCurve,
  fanDip,
  fanPowerKw,
  frameTimeAt,
} from './mockExpertControlGen.js';

const SMALL_GEOMETRY: Geometry = {
  geometryId: 'test-geometry',
  room: { size: [4, 4, 2] },
  points: [
    { id: 0, x: 0.5, y: 0.5, z: 0.5 },
    { id: 1, x: 3.5, y: 3.5, z: 1.5 },
    { id: 2, x: 2, y: 2, z: 1 },
  ],
  grid: { origin: [0, 0, 0], spacing: [1, 1, 1], size: [3, 3, 2] }, // 18개
  flowGrid: { origin: [0.5, 0.5, 0.5], spacing: [2, 2, 1], size: [2, 2, 2] }, // 8개
};

const BASE_TIME = new Date('2026-10-05T00:00:00Z'); // kstWallClock류 표현(실제 타임존 의미 없음, 상대 계산용)

const DAY_CYCLE = { tOutBase: 22, tOutAmplitude: 6, rhOutBase: 70, rhOutAmplitude: 15 };
const FAN_BASELINE = { min: 20, max: 90 };

describe('frameTimeAt', () => {
  it('10분 간격으로 증가한다', () => {
    expect(frameTimeAt(BASE_TIME, 0)).toBe('2026-10-05T00:00:00');
    expect(frameTimeAt(BASE_TIME, 1)).toBe('2026-10-05T00:10:00');
    expect(frameTimeAt(BASE_TIME, 6)).toBe('2026-10-05T01:00:00');
  });
});

describe('dayCycleOutdoor', () => {
  it('자정 부근(index 0)이 가장 낮고, 정오 부근(frameCount/2)이 가장 높다', () => {
    const mid = Math.round(EXPERT_CONTROL_FRAME_COUNT / 2);
    const start = dayCycleOutdoor(0, EXPERT_CONTROL_FRAME_COUNT, DAY_CYCLE);
    const noon = dayCycleOutdoor(mid, EXPERT_CONTROL_FRAME_COUNT, DAY_CYCLE);
    expect(noon.T_out).toBeGreaterThan(start.T_out);
    expect(noon.RH_out).toBeLessThan(start.RH_out); // 더울 때 더 건조(반대 상관)
  });

  it('습도는 0~100 범위를 벗어나지 않는다', () => {
    for (let i = 0; i < EXPERT_CONTROL_FRAME_COUNT; i += 1) {
      const { RH_out } = dayCycleOutdoor(i, EXPERT_CONTROL_FRAME_COUNT, { ...DAY_CYCLE, rhOutAmplitude: 200 });
      expect(RH_out).toBeGreaterThanOrEqual(0);
      expect(RH_out).toBeLessThanOrEqual(100);
    }
  });
});

describe('fanBellCurve', () => {
  it('가장자리는 min, 중앙은 max에 가깝다(완만한 종 모양)', () => {
    const edge0 = fanBellCurve(0, EXPERT_CONTROL_FRAME_COUNT, FAN_BASELINE);
    const edgeLast = fanBellCurve(EXPERT_CONTROL_FRAME_COUNT - 1, EXPERT_CONTROL_FRAME_COUNT, FAN_BASELINE);
    const mid = fanBellCurve(Math.floor(EXPERT_CONTROL_FRAME_COUNT / 2), EXPERT_CONTROL_FRAME_COUNT, FAN_BASELINE);
    expect(edge0).toBeCloseTo(FAN_BASELINE.min, 5);
    expect(edgeLast).toBeCloseTo(FAN_BASELINE.min, 5);
    expect(mid).toBeGreaterThan(edge0);
    expect(mid).toBeLessThanOrEqual(FAN_BASELINE.max);
  });
});

describe('fanDip', () => {
  it('중심에서 가장 깊고 멀어질수록 0에 가까워진다', () => {
    const cfg = { centerFrac: 0.5, widthFrac: 0.15, amplitude: 25 };
    const center = fanDip(Math.round((EXPERT_CONTROL_FRAME_COUNT - 1) * 0.5), EXPERT_CONTROL_FRAME_COUNT, cfg);
    const farEdge = fanDip(0, EXPERT_CONTROL_FRAME_COUNT, cfg);
    expect(center).toBeCloseTo(25, 5);
    expect(farEdge).toBeLessThan(center);
  });
});

describe('fanPowerKw', () => {
  it('가동률 0이면 전력도 0, 100이면 정격전력과 같다', () => {
    expect(fanPowerKw(0, 0.75)).toBe(0);
    expect(fanPowerKw(100, 0.75)).toBeCloseTo(0.75, 5);
  });

  it('가동률이 낮을수록 전력도 단조 감소한다(세제곱 근사)', () => {
    expect(fanPowerKw(20, 0.75)).toBeLessThan(fanPowerKw(60, 0.75));
    expect(fanPowerKw(60, 0.75)).toBeLessThan(fanPowerKw(100, 0.75));
  });
});

const EXPERT_OPTS = { dayCycle: DAY_CYCLE, fan: FAN_BASELINE };
const PLACEHOLDER_INPUT = { temp: 28, rh: 65, vent: 60 };

describe('buildExpertDetailMock', () => {
  it('145프레임, geometry 배열 개수와 일치, input은 넘긴 값 그대로', () => {
    const detail = buildExpertDetailMock(SMALL_GEOMETRY, BASE_TIME, EXPERT_OPTS, PLACEHOLDER_INPUT);
    expect(detail.mode).toBe('expert');
    expect(detail.frames).toHaveLength(145);
    expect(detail.frames[0]?.points.temp).toHaveLength(SMALL_GEOMETRY.points.length);
    expect(detail.frames[0]?.grid.temp).toHaveLength(18);
    expect(detail.frames[0]?.flow).toHaveLength(8);
    expect(detail.geometryId).toBe(SMALL_GEOMETRY.geometryId);
    expect(detail.input).toEqual(PLACEHOLDER_INPUT);
  });

  it('결정적이다 — 같은 입력이면 항상 같은 출력', () => {
    const a = buildExpertDetailMock(SMALL_GEOMETRY, BASE_TIME, EXPERT_OPTS, PLACEHOLDER_INPUT);
    const b = buildExpertDetailMock(SMALL_GEOMETRY, BASE_TIME, EXPERT_OPTS, PLACEHOLDER_INPUT);
    expect(a).toEqual(b);
  });
});

const CONTROL_OPTS = {
  dayCycle: DAY_CYCLE,
  fanBaseline: FAN_BASELINE,
  dip: { centerFrac: 0.5, widthFrac: 0.15, amplitude: 25 },
  tMeanMaxConstraint: 29,
  fanRatedKw: 0.75,
};

describe('buildControlDetailMock', () => {
  it('145프레임 + control 블록(필드 전부 145개 배열)', () => {
    const detail = buildControlDetailMock(SMALL_GEOMETRY, BASE_TIME, 'energy', CONTROL_OPTS);
    expect(detail.mode).toBe('control');
    expect(detail.target).toBe('energy');
    expect(detail.frames).toHaveLength(145);
    expect(detail.control.baselineFanPct).toHaveLength(145);
    expect(detail.control.optimizedFanPct).toHaveLength(145);
    expect(detail.control.baselineTMean).toHaveLength(145);
    expect(detail.control.optimizedTMean).toHaveLength(145);
  });

  it('optimized는 baseline보다 에너지를 덜 쓰고(절감률 > 0), 그만큼 평균온도는 더 높아진다', () => {
    const detail = buildControlDetailMock(SMALL_GEOMETRY, BASE_TIME, 'energy', CONTROL_OPTS);
    expect(detail.control.energyKwh.optimized).toBeLessThan(detail.control.energyKwh.baseline);
    expect(detail.control.savingPct).toBeGreaterThan(0);
  });

  it('energy target이 environment target보다 절감률이 더 크다(dip이 더 깊을 때)', () => {
    const energyLike = buildControlDetailMock(SMALL_GEOMETRY, BASE_TIME, 'energy', {
      ...CONTROL_OPTS,
      dip: { centerFrac: 0.5, widthFrac: 0.15, amplitude: 30 },
    });
    const environmentLike = buildControlDetailMock(SMALL_GEOMETRY, BASE_TIME, 'environment', {
      ...CONTROL_OPTS,
      dip: { centerFrac: 0.5, widthFrac: 0.15, amplitude: 10 },
    });
    expect(energyLike.control.savingPct).toBeGreaterThan(environmentLike.control.savingPct);
  });

  it('결정적이다 — 같은 입력이면 항상 같은 출력', () => {
    const a = buildControlDetailMock(SMALL_GEOMETRY, BASE_TIME, 'environment', CONTROL_OPTS);
    const b = buildControlDetailMock(SMALL_GEOMETRY, BASE_TIME, 'environment', CONTROL_OPTS);
    expect(a).toEqual(b);
  });
});
