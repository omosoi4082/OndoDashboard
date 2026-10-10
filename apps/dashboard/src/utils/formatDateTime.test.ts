import { describe, expect, it } from 'vitest';
import { formatHeaderDate, formatHeaderTime, formatHeaderWeekday } from './formatDateTime.js';

describe('formatHeaderDate / formatHeaderWeekday / formatHeaderTime', () => {
  it('2026-10-05 / 월요일 / 15:30:24 형식으로 포맷한다', () => {
    const date = new Date(2026, 9, 5, 15, 30, 24); // month: 0-based
    expect(formatHeaderDate(date)).toBe('2026-10-05');
    expect(formatHeaderWeekday(date)).toBe('월요일');
    expect(formatHeaderTime(date)).toBe('15:30:24');
  });

  it('한 자리 월/일/시/분/초는 0으로 채운다', () => {
    const date = new Date(2026, 0, 1, 2, 3, 4);
    expect(formatHeaderDate(date)).toBe('2026-01-01');
    expect(formatHeaderWeekday(date)).toBe('목요일');
    expect(formatHeaderTime(date)).toBe('02:03:04');
  });
});
