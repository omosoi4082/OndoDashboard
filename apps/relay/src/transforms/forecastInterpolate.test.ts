import { describe, expect, it } from 'vitest';
import {
  fanPctFromTemp,
  fillHourlyGaps,
  fiveMinuteSeriesMarks,
  floorToHour,
  ceilToHour,
  hourKeyOf,
  hourlyMarks,
  hourlyValuesAtMarks,
  interpolateAtTime,
  mergeHourlyFallback,
} from './forecastInterpolate.js';

// kstWallClock() 변환 결과를 흉내 낸다: UTC 필드 = KST 벽시계 값(currentWindow.test.ts와 동일 패턴).
function kst(y: number, m: number, d: number, h: number, mi: number, s = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, mi, s));
}

describe('floorToHour/ceilToHour', () => {
  it('정시가 아니면 내림/올림한다', () => {
    expect(floorToHour(kst(2026, 10, 7, 15, 25))).toEqual(kst(2026, 10, 7, 15, 0));
    expect(ceilToHour(kst(2026, 10, 7, 15, 25))).toEqual(kst(2026, 10, 7, 16, 0));
  });

  it('이미 정시면 그대로', () => {
    expect(floorToHour(kst(2026, 10, 7, 15, 0))).toEqual(kst(2026, 10, 7, 15, 0));
    expect(ceilToHour(kst(2026, 10, 7, 15, 0))).toEqual(kst(2026, 10, 7, 15, 0));
  });

  it('자정 넘김: 23:30 올림 → 다음날 00:00', () => {
    expect(ceilToHour(kst(2026, 10, 7, 23, 30))).toEqual(kst(2026, 10, 8, 0, 0));
  });
});

describe('hourlyMarks', () => {
  it('자정을 넘겨도 1시간 간격으로 이어진다', () => {
    const marks = hourlyMarks(kst(2026, 10, 7, 23, 0), kst(2026, 10, 8, 2, 0));
    expect(marks).toHaveLength(4);
    expect(marks[0]).toEqual(kst(2026, 10, 7, 23, 0));
    expect(marks[1]).toEqual(kst(2026, 10, 8, 0, 0));
    expect(marks[3]).toEqual(kst(2026, 10, 8, 2, 0));
  });
});

describe('hourlyValuesAtMarks/hourKeyOf', () => {
  it('키로 찾고 없으면 null', () => {
    const marks = hourlyMarks(kst(2026, 10, 7, 15, 0), kst(2026, 10, 7, 17, 0));
    const map = new Map<string, number>([[hourKeyOf(kst(2026, 10, 7, 16, 0)), 25]]);
    const values = hourlyValuesAtMarks(marks, map);
    expect(values).toEqual([null, 25, null]);
  });
});

describe('fillHourlyGaps', () => {
  it('짧은 결측(1시간)은 앞뒤 값으로 보간한다', () => {
    const result = fillHourlyGaps([20, null, 24], 3);
    expect(result.failed).toBe(false);
    expect(result.values).toEqual([20, 22, 24]);
  });

  it('연속 결측이 maxGapHours 이상이면 failed', () => {
    const result = fillHourlyGaps([20, null, null, null, 24], 3);
    expect(result.failed).toBe(true);
  });

  it('맨 끝 결측은 가장 가까운 값으로 채운다(짧은 결측일 때만)', () => {
    const result = fillHourlyGaps([null, 20, 22], 3);
    expect(result.failed).toBe(false);
    expect(result.values).toEqual([20, 20, 22]);
  });

  it('전부 결측이면 보간 불가 — failed 아니어도 null 유지', () => {
    const result = fillHourlyGaps([null, null], 3);
    // 연속 결측 길이(2) < maxGapHours(3)이므로 failed는 아니지만 양쪽 값이 없어 보간 불가.
    expect(result.failed).toBe(false);
    expect(result.values).toEqual([null, null]);
  });
});

describe('mergeHourlyFallback', () => {
  it('primary의 결측 슬롯만 fallback 값으로 채운다', () => {
    const merged = mergeHourlyFallback([20, null, null], [19, 21, null]);
    expect(merged).toEqual([20, 21, null]);
  });
});

describe('interpolateAtTime', () => {
  const hourMarksArr = hourlyMarks(kst(2026, 10, 7, 15, 0), kst(2026, 10, 7, 17, 0));
  const hourValues = [20, 24, 22];

  it('정시 사이는 선형 보간', () => {
    const v = interpolateAtTime(kst(2026, 10, 7, 15, 30), hourMarksArr, hourValues);
    expect(v).toBeCloseTo(22, 5);
  });

  it('범위 시작 이전이면 첫 값', () => {
    const v = interpolateAtTime(kst(2026, 10, 7, 14, 0), hourMarksArr, hourValues);
    expect(v).toBe(20);
  });

  it('범위 끝 이후면 마지막 값', () => {
    const v = interpolateAtTime(kst(2026, 10, 7, 18, 0), hourMarksArr, hourValues);
    expect(v).toBe(22);
  });

  it('정시 그 자체는 해당 값', () => {
    const v = interpolateAtTime(kst(2026, 10, 7, 16, 0), hourMarksArr, hourValues);
    expect(v).toBe(24);
  });
});

describe('fiveMinuteSeriesMarks', () => {
  it('288건(24시간) 5분 간격', () => {
    const marks = fiveMinuteSeriesMarks(kst(2026, 10, 7, 15, 25), 288);
    expect(marks).toHaveLength(288);
    expect(marks[0]).toEqual(kst(2026, 10, 7, 15, 25));
    expect(marks[1]).toEqual(kst(2026, 10, 7, 15, 30));
    expect(marks[287]).toEqual(kst(2026, 10, 8, 15, 20));
  });
});

describe('fanPctFromTemp', () => {
  const cfg = { tLow: 22, tHigh: 30, min: 20, max: 100 };

  it('기준 공식: clamp(20 + 80*(T_out-22)/8, 20, 100)', () => {
    expect(fanPctFromTemp(26, cfg)).toBeCloseTo(60, 5); // 20 + 80*4/8 = 60
  });

  it('하한 아래는 min으로 clamp', () => {
    expect(fanPctFromTemp(10, cfg)).toBe(20);
  });

  it('상한 위는 max로 clamp', () => {
    expect(fanPctFromTemp(40, cfg)).toBe(100);
  });

  it('소수 1자리로 반올림', () => {
    expect(fanPctFromTemp(22.33, cfg)).toBe(23.3); // 20 + 80*0.33/8 = 23.3
  });
});
