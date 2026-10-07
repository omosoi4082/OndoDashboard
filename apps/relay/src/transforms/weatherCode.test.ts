import { describe, expect, it } from 'vitest';
import { kmaWeatherCode, ptyToWeatherCode, skyToWeatherCode, stationWeatherCode } from './weatherCode.js';

describe('ptyToWeatherCode', () => {
  it('1,5 → RAIN', () => {
    expect(ptyToWeatherCode(1)).toBe('RAIN');
    expect(ptyToWeatherCode(5)).toBe('RAIN');
  });
  it('2,6 → RAIN_SNOW', () => {
    expect(ptyToWeatherCode(2)).toBe('RAIN_SNOW');
    expect(ptyToWeatherCode(6)).toBe('RAIN_SNOW');
  });
  it('3,7 → SNOW', () => {
    expect(ptyToWeatherCode(3)).toBe('SNOW');
    expect(ptyToWeatherCode(7)).toBe('SNOW');
  });
  it('0은 null(SKY로 대체 판정)', () => {
    expect(ptyToWeatherCode(0)).toBeNull();
  });
});

describe('skyToWeatherCode', () => {
  it('1 → CLEAR, 3 → MOSTLY_CLOUDY, 4 → OVERCAST', () => {
    expect(skyToWeatherCode(1)).toBe('CLEAR');
    expect(skyToWeatherCode(3)).toBe('MOSTLY_CLOUDY');
    expect(skyToWeatherCode(4)).toBe('OVERCAST');
  });
  it('2나 그 외 값은 null', () => {
    expect(skyToWeatherCode(2)).toBeNull();
    expect(skyToWeatherCode(9)).toBeNull();
  });
});

describe('kmaWeatherCode (3-1 결정 규칙)', () => {
  it('PTY≠0이면 PTY 우선(SKY 무시)', () => {
    expect(kmaWeatherCode(1, 1)).toBe('RAIN');
  });
  it('PTY=0이면 SKY로 판정', () => {
    expect(kmaWeatherCode(0, 4)).toBe('OVERCAST');
  });
  it('PTY=null이면 SKY로 판정', () => {
    expect(kmaWeatherCode(null, 1)).toBe('CLEAR');
  });
  it('PTY=0이고 SKY도 없으면 null', () => {
    expect(kmaWeatherCode(0, null)).toBeNull();
  });
  it('둘 다 없으면 null', () => {
    expect(kmaWeatherCode(null, null)).toBeNull();
  });
});

describe('stationWeatherCode (3-2 미세기후 결정 규칙)', () => {
  it('RAIN>0이면 시간 무관 RAIN', () => {
    expect(stationWeatherCode({ rain: 1.2, solar: null, hour: 3 })).toBe('RAIN');
    expect(stationWeatherCode({ rain: 0.1, solar: 900, hour: 12 })).toBe('RAIN');
  });

  it('11~14시 미만 구간에서 SOLAR 임계값으로 판정', () => {
    expect(stationWeatherCode({ rain: 0, solar: 700, hour: 11 })).toBe('CLEAR');
    expect(stationWeatherCode({ rain: 0, solar: 500, hour: 12 })).toBe('PARTLY_CLOUDY');
    expect(stationWeatherCode({ rain: 0, solar: 200, hour: 13 })).toBe('MOSTLY_CLOUDY');
    expect(stationWeatherCode({ rain: 0, solar: 50, hour: 13 })).toBe('OVERCAST');
  });

  it('14시 정각부터는 판정 구간 밖(null)', () => {
    expect(stationWeatherCode({ rain: 0, solar: 900, hour: 14 })).toBeNull();
  });

  it('판정 구간 밖이고 비가 없으면 null', () => {
    expect(stationWeatherCode({ rain: 0, solar: 900, hour: 20 })).toBeNull();
    expect(stationWeatherCode({ rain: null, solar: null, hour: 3 })).toBeNull();
  });

  it('판정 구간 안이지만 SOLAR가 없으면 null', () => {
    expect(stationWeatherCode({ rain: 0, solar: null, hour: 12 })).toBeNull();
  });
});
