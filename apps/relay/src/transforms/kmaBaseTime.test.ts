import { describe, expect, it } from 'vitest';
import {
  kmaBaseTimeToIso,
  ultraSrtFcstBaseTime,
  ultraSrtNcstBaseTime,
  vilageFcstBaseTime,
} from './kmaBaseTime.js';

// now는 kstWallClock() 변환 결과를 흉내 낸다: UTC 필드 = KST 벽시계 값.
function kst(y: number, m: number, d: number, h: number, mi = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, mi));
}

describe('ultraSrtNcstBaseTime (매시 HH00)', () => {
  it('같은 시의 정각을 돌려준다', () => {
    expect(ultraSrtNcstBaseTime(kst(2026, 10, 7, 15, 28))).toEqual({ baseDate: '20261007', baseTime: '1500' });
  });

  it('자정(00:xx)이면 당일 0000', () => {
    expect(ultraSrtNcstBaseTime(kst(2026, 10, 7, 0, 15))).toEqual({ baseDate: '20261007', baseTime: '0000' });
  });

  it('stepsBack=1이면 한 시간 전, 0시에서는 전날로 넘어간다', () => {
    expect(ultraSrtNcstBaseTime(kst(2026, 10, 7, 0, 15), 1)).toEqual({ baseDate: '20261006', baseTime: '2300' });
  });

  it('월 경계도 넘는다', () => {
    expect(ultraSrtNcstBaseTime(kst(2026, 11, 1, 0, 5), 1)).toEqual({ baseDate: '20261031', baseTime: '2300' });
  });
});

describe('ultraSrtFcstBaseTime (매시 HH30)', () => {
  it('30분 이후면 같은 시의 HH30', () => {
    expect(ultraSrtFcstBaseTime(kst(2026, 10, 7, 15, 45))).toEqual({ baseDate: '20261007', baseTime: '1530' });
  });

  it('30분 이전이면 직전 시의 HH30', () => {
    expect(ultraSrtFcstBaseTime(kst(2026, 10, 7, 15, 10))).toEqual({ baseDate: '20261007', baseTime: '1430' });
  });

  it('자정 넘김: 00:10이면 전날 23:30', () => {
    expect(ultraSrtFcstBaseTime(kst(2026, 10, 7, 0, 10))).toEqual({ baseDate: '20261006', baseTime: '2330' });
  });

  it('stepsBack=1이면 한 번 더 이전 시각', () => {
    expect(ultraSrtFcstBaseTime(kst(2026, 10, 7, 15, 45), 1)).toEqual({ baseDate: '20261007', baseTime: '1430' });
  });
});

describe('vilageFcstBaseTime (02·05·08·11·14·17·20·23시)', () => {
  it('정각 사이 시각은 직전 발표 슬롯', () => {
    expect(vilageFcstBaseTime(kst(2026, 10, 7, 15, 26))).toEqual({ baseDate: '20261007', baseTime: '1400' });
  });

  it('02시 이전(자정 넘김)은 전날 23시 발표분', () => {
    expect(vilageFcstBaseTime(kst(2026, 10, 7, 0, 30))).toEqual({ baseDate: '20261006', baseTime: '2300' });
    expect(vilageFcstBaseTime(kst(2026, 10, 7, 1, 59))).toEqual({ baseDate: '20261006', baseTime: '2300' });
  });

  it('슬롯 시각 정각이면 그 슬롯 자체', () => {
    expect(vilageFcstBaseTime(kst(2026, 10, 7, 2, 0))).toEqual({ baseDate: '20261007', baseTime: '0200' });
  });

  it('stepsBack=1로 자정을 넘어 전날로 간다', () => {
    expect(vilageFcstBaseTime(kst(2026, 10, 7, 2, 0), 1)).toEqual({ baseDate: '20261006', baseTime: '2300' });
  });

  it('stepsBack=1(자정 넘김 아닌 일반 케이스)', () => {
    expect(vilageFcstBaseTime(kst(2026, 10, 7, 15, 26), 1)).toEqual({ baseDate: '20261007', baseTime: '1100' });
  });

  it('연도 경계도 넘는다', () => {
    expect(vilageFcstBaseTime(kst(2027, 1, 1, 0, 30))).toEqual({ baseDate: '20261231', baseTime: '2300' });
  });
});

describe('kmaBaseTimeToIso', () => {
  it('YYYYMMDD/HHmm → +09:00 ISO 문자열', () => {
    expect(kmaBaseTimeToIso({ baseDate: '20261007', baseTime: '1500' })).toBe('2026-10-07T15:00:00+09:00');
  });
});
