import { describe, expect, it } from 'vitest';
import { isNightAt } from './sunTimes.js';

// 농장 좌표(.env FARM_LAT/FARM_LON): 제주 인근.
const FARM_LAT = 33.446297;
const FARM_LON = 126.563879;

describe('isNightAt', () => {
  it('한낮(KST 12시경)은 낮', () => {
    // 2026-10-07T03:00:00Z = 2026-10-07 12:00 KST
    const noon = new Date('2026-10-07T03:00:00Z');
    expect(isNightAt(noon, FARM_LAT, FARM_LON)).toBe(false);
  });

  it('한밤(KST 새벽 2시경)은 밤', () => {
    // 2026-10-07T17:00:00Z = 2026-10-08 02:00 KST
    const midnight = new Date('2026-10-07T17:00:00Z');
    expect(isNightAt(midnight, FARM_LAT, FARM_LON)).toBe(true);
  });
});
