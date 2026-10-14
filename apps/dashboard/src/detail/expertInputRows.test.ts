import { describe, expect, it } from 'vitest';
import { expertExampleDrafts, expertRowTimes, formatExpertRowTime } from './expertInputRows.js';

describe('expertRowTimes', () => {
  it('첫 행은 현재 시각 다음 정시, 1시간 간격 24개', () => {
    const times = expertRowTimes(new Date(2026, 9, 14, 15, 26, 30), 24);
    expect(times).toHaveLength(24);
    expect(times[0]).toEqual(new Date(2026, 9, 14, 16, 0, 0));
    expect(times[23]).toEqual(new Date(2026, 9, 15, 15, 0, 0));
  });

  it('정시 정각이면 다음 정시부터', () => {
    expect(expertRowTimes(new Date(2026, 9, 14, 15, 0, 0), 1)[0]).toEqual(new Date(2026, 9, 14, 16, 0, 0));
  });
});

describe('formatExpertRowTime', () => {
  it('HH:00, 자정만 날짜를 붙인다', () => {
    expect(formatExpertRowTime(new Date(2026, 9, 14, 16, 0))).toBe('16:00');
    expect(formatExpertRowTime(new Date(2026, 9, 15, 0, 0))).toBe('10-15 00:00');
  });
});

describe('expertExampleDrafts', () => {
  it('mock_expert.json 정시 값 24개(첫 행 16:00 값)', () => {
    const drafts = expertExampleDrafts();
    expect(drafts).toHaveLength(24);
    expect(drafts[0]).toEqual({ temp: '37.17', rh: '59.2', vent: '100' });
    expect(drafts[23]).toEqual({ temp: '37.41', rh: '58.9', vent: '100' });
  });
});
