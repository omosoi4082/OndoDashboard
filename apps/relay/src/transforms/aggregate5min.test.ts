import { describe, expect, it } from 'vitest';
import {
  aggregateAndValidate,
  aggregateToFiveMinute,
  analyzeGaps,
  clampRange,
  interpolateShortGaps,
  isSensorError,
  type AggregateThresholds,
} from './aggregate5min.js';

const THRESHOLDS: AggregateThresholds = {
  interpMaxGap: 3,
  errorMinGap: 4,
  errorMaxRatio: 0.2,
  rangeMin: -30,
  rangeMax: 50,
};

function repeat(value: number | null, n: number): (number | null)[] {
  return new Array(n).fill(value);
}

describe('aggregateToFiveMinute', () => {
  it('181개(1분) 상수값 → 37개(5분) 같은 값', () => {
    const oneMin = repeat(20, 181);
    const result = aggregateToFiveMinute(oneMin);
    expect(result).toHaveLength(37);
    expect(result.every((v) => v === 20)).toBe(true);
  });

  it('구간 맨 앞 마크는 창을 구간 안으로 줄여 평균한다(t-4 쪽이 구간 밖)', () => {
    const oneMin = repeat(10, 181);
    // 첫 마크는 index 0만 가용(앞쪽 -4..-1은 없음) → 평균은 index 0 값 그대로.
    const result = aggregateToFiveMinute(oneMin);
    expect(result[0]).toBe(10);
  });

  it('null은 평균에서 제외한다', () => {
    const oneMin = repeat(10, 181);
    // 두 번째 마크(index 5) 창: index 1..5. 그 중 하나를 null로.
    oneMin[3] = null;
    const result = aggregateToFiveMinute(oneMin);
    expect(result[1]).toBe(10); // 나머지 값이 모두 10이므로 평균도 10
  });

  it('창 안이 모두 null이면 결과도 null', () => {
    const oneMin = repeat(null, 181);
    const result = aggregateToFiveMinute(oneMin);
    expect(result.every((v) => v === null)).toBe(true);
  });

  it('반올림하지 않는다', () => {
    const oneMin = repeat(10, 181);
    oneMin[0] = 10;
    oneMin[1] = 11; // index 1..5 창 평균 = (11+10+10+10+10)/5 = 10.2
    const result = aggregateToFiveMinute(oneMin);
    expect(result[1]).toBeCloseTo(10.2, 10);
  });
});

describe('interpolateShortGaps', () => {
  it('연속 결측이 maxGap 이하면 선형 보간', () => {
    const values = [10, null, null, 20];
    const result = interpolateShortGaps(values, 3);
    expect(result[1]).toBeCloseTo(13.333333, 5);
    expect(result[2]).toBeCloseTo(16.666666, 5);
  });

  it('구간 맨 앞이 결측이면(길이 ≤maxGap) 가장 가까운 값을 복사', () => {
    const values = [null, null, 20, 20];
    const result = interpolateShortGaps(values, 3);
    expect(result).toEqual([20, 20, 20, 20]);
  });

  it('구간 맨 뒤가 결측이면(길이 ≤maxGap) 가장 가까운 값을 복사', () => {
    const values = [20, 20, null, null];
    const result = interpolateShortGaps(values, 3);
    expect(result).toEqual([20, 20, 20, 20]);
  });

  it('연속 결측이 maxGap을 넘으면 보간하지 않고 null 유지', () => {
    const values = [10, null, null, null, null, 20];
    const result = interpolateShortGaps(values, 3);
    expect(result).toEqual([10, null, null, null, null, 20]);
  });

  it('전체가 null이면 그대로 null', () => {
    const values = [null, null, null];
    const result = interpolateShortGaps(values, 3);
    expect(result).toEqual([null, null, null]);
  });
});

describe('analyzeGaps / isSensorError', () => {
  it('연속 결측 20분(4행) 이상이면 오류', () => {
    const values = [...repeat(20, 10), ...repeat(null, 4), ...repeat(20, 23)];
    const info = analyzeGaps(values);
    expect(info.maxConsecutiveGap).toBe(4);
    expect(isSensorError(info, THRESHOLDS)).toBe(true);
  });

  it('연속 결측 15분(3행) 이하면(비율도 낮으면) 오류 아님', () => {
    const values = [...repeat(20, 10), ...repeat(null, 3), ...repeat(20, 24)];
    const info = analyzeGaps(values);
    expect(isSensorError(info, THRESHOLDS)).toBe(false);
  });

  it('37행 중 결측 비율이 20%를 넘으면 오류(개별 gap은 짧아도) — 8/37≈21.6%', () => {
    // 1행씩 띄엄띄엄 8개 결측 (각 gap=1, 연속 길이는 짧음) → 비율 8/37 > 0.2
    const values = repeat(20, 37);
    const nullIdx = [0, 4, 8, 12, 16, 20, 24, 28];
    for (const i of nullIdx) values[i] = null;
    const info = analyzeGaps(values);
    expect(info.maxConsecutiveGap).toBe(1);
    expect(info.missingCount).toBe(8);
    expect(isSensorError(info, THRESHOLDS)).toBe(true);
  });

  it('결측 비율이 20% 이하면 오류 아님 — 7/37≈18.9%', () => {
    const values = repeat(20, 37);
    const nullIdx = [0, 4, 8, 12, 16, 20, 24];
    for (const i of nullIdx) values[i] = null;
    const info = analyzeGaps(values);
    expect(info.missingCount).toBe(7);
    expect(isSensorError(info, THRESHOLDS)).toBe(false);
  });
});

describe('clampRange', () => {
  it('범위 밖 값은 null로 바꾼다', () => {
    const values = [-40, 0, 25, 60, null];
    expect(clampRange(values, -30, 50)).toEqual([null, 0, 25, null, null]);
  });
});

describe('aggregateAndValidate (전체 파이프라인)', () => {
  it('정상 케이스: 결측 없음 → 오류 없음, 값 그대로', () => {
    const oneMin = repeat(20, 181);
    const result = aggregateAndValidate(oneMin, THRESHOLDS);
    expect(result.error).toBeNull();
    expect(result.values).toHaveLength(37);
    expect(result.values.every((v) => v === 20)).toBe(true);
  });

  it('15분 이하 결측은 보간되어 오류 없음', () => {
    const oneMin = repeat(20, 181);
    // 5분 마크 기준 연속 3개(15분) null
    for (let i = 50; i < 65; i += 1) oneMin[i] = null;
    const result = aggregateAndValidate(oneMin, THRESHOLDS);
    expect(result.error).toBeNull();
    expect(result.values.some((v) => v === null)).toBe(false);
  });

  it('20분 이상 결측이면 센서 오류 판정, missingMinutes 포함', () => {
    const oneMin = repeat(20, 181);
    // 1분 슬롯 기준 넉넉히 30분(5분마크 6개 분량) 비움 → 집계 후에도 연속 결측 ≥4
    for (let i = 40; i < 70; i += 1) oneMin[i] = null;
    const result = aggregateAndValidate(oneMin, THRESHOLDS);
    expect(result.error).not.toBeNull();
    expect(result.error?.missingMinutes).toBeGreaterThan(0);
  });

  it('37행 중 20% 초과 결측(개별로는 짧은 gap)이면 오류', () => {
    const oneMin = repeat(20, 181);
    // 5분 마크 9개 지점의 1분 창을 모두 null로 만들어 비율 초과를 유도
    const markOffsets = [0, 20, 40, 60, 80, 100, 120, 140, 160];
    for (const off of markOffsets) {
      for (let i = Math.max(0, off - 4); i <= off; i += 1) oneMin[i] = null;
    }
    const result = aggregateAndValidate(oneMin, THRESHOLDS);
    expect(result.error).not.toBeNull();
  });

  it('범위 밖 값은 null 처리 후 재보간/재판정된다', () => {
    const oneMin = repeat(20, 181);
    // 5분 마크 하나(인덱스 100 근방)만 범위를 벗어난 값으로
    for (let i = 96; i <= 100; i += 1) oneMin[i] = 999;
    const result = aggregateAndValidate(oneMin, THRESHOLDS);
    // 범위 밖 처리로 생긴 결측 1개(짧음) → 보간되어 오류 없음
    expect(result.error).toBeNull();
    expect(result.values.every((v) => v !== null && v >= -30 && v <= 50)).toBe(true);
  });

  it('구간 끝 결측은 가장 가까운 값으로 복사되어 오류 없음', () => {
    const oneMin = repeat(20, 181);
    for (let i = 170; i < 181; i += 1) oneMin[i] = null; // 끝 11분(5분마크 2개 분량)
    const result = aggregateAndValidate(oneMin, THRESHOLDS);
    expect(result.error).toBeNull();
    expect(result.values[36]).toBe(20);
  });
});
