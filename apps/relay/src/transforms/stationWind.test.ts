import { describe, expect, it } from 'vitest';
import { stationWindMs } from './stationWind.js';

describe('stationWindMs', () => {
  it('받은 값을 그대로 쓴다 — 2026-10-19 온도 측 재확인(3.6으로 나누지 않는다)', () => {
    expect(stationWindMs(14)).toBe(14);
    expect(stationWindMs(3.3)).toBe(3.3);
    expect(stationWindMs(8)).toBe(8);
  });

  it('0은 0으로 둔다(무풍)', () => {
    expect(stationWindMs(0)).toBe(0);
  });

  it('소수 첫째 자리까지만 반올림한다(기상청 WSD와 표기 단위 맞춤)', () => {
    expect(stationWindMs(3.456)).toBe(3.5);
    expect(stationWindMs(2.04)).toBe(2);
  });

  it('결측은 null로 유지한다(0으로 채우지 않는다)', () => {
    expect(stationWindMs(null)).toBeNull();
    expect(stationWindMs(Number.NaN)).toBeNull();
  });
});
