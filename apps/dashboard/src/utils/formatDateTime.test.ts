import { describe, expect, it } from 'vitest';
import { formatKoreanDateTime } from './formatDateTime.js';

describe('formatKoreanDateTime', () => {
  it('2026-10-05(월) 15:30:24 형식으로 포맷한다', () => {
    const date = new Date(2026, 9, 5, 15, 30, 24); // month: 0-based
    expect(formatKoreanDateTime(date)).toBe('2026년 10월 05일 (월) 15:30:24');
  });

  it('한 자리 월/일/시/분/초는 0으로 채운다', () => {
    const date = new Date(2026, 0, 1, 2, 3, 4);
    expect(formatKoreanDateTime(date)).toBe('2026년 01월 01일 (목) 02:03:04');
  });
});
