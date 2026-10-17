import { describe, expect, it } from 'vitest';
import { stationWindKmhToMs } from './stationWind.js';

describe('stationWindKmhToMs', () => {
  it('2026-10-17 실측값 — 14 km/h는 기상청 3.7 m/s와 맞는 3.9 m/s가 된다', () => {
    expect(stationWindKmhToMs(14)).toBe(3.9);
  });

  it('같은 시각 MAXWIND 32 km/h = 8.9 m/s (m/s로 읽으면 태풍급이라 성립하지 않던 값)', () => {
    expect(stationWindKmhToMs(32)).toBe(8.9);
  });

  it('0은 0 — 무풍을 결측으로 만들지 않는다', () => {
    expect(stationWindKmhToMs(0)).toBe(0);
  });

  it('소수 첫째 자리까지 반올림한다(기상청 WSD 표기와 맞춤)', () => {
    expect(stationWindKmhToMs(3.6)).toBe(1);
    expect(stationWindKmhToMs(10)).toBe(2.8);
    expect(stationWindKmhToMs(1)).toBe(0.3);
  });

  it('결측(null)과 숫자가 아닌 값은 null로 둔다', () => {
    expect(stationWindKmhToMs(null)).toBeNull();
    expect(stationWindKmhToMs(Number.NaN)).toBeNull();
  });
});
