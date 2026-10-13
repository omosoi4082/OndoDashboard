import { describe, expect, it } from 'vitest';
import { formatKstWallClockCompact, formatKstWallClockNaive, kstWallClock } from './time.js';

describe('formatKstWallClockCompact', () => {
  // 2026-10-13 온도 측 A-1: 센서 서버가 14자리로 읽기 때문에 12자리로 보내면 분·초가
  // 밀린다("202610090950" → 09:05:00). 항상 초까지 붙여 14자리로 보낸다.
  it('14자리(YYYYMMDDHHmmss)로 포맷한다', () => {
    const d = kstWallClock(new Date('2026-10-09T00:50:00.000Z')); // KST 09:50
    expect(formatKstWallClockCompact(d)).toBe('20261009095000');
  });

  it('정각도 초 자리를 00으로 채운다', () => {
    const d = kstWallClock(new Date('2026-10-09T03:00:00.000Z')); // KST 12:00
    expect(formatKstWallClockCompact(d)).toBe('20261009120000');
  });

  it('한 자리 월·일·시·분을 0으로 채운다', () => {
    const d = kstWallClock(new Date('2026-01-02T00:04:00.000Z')); // KST 09:04
    expect(formatKstWallClockCompact(d)).toBe('20260102090400');
  });

  it('A-1 예시 구간(09:50~12:50)을 그대로 만든다', () => {
    const start = kstWallClock(new Date('2026-10-09T00:50:00.000Z'));
    const end = kstWallClock(new Date('2026-10-09T03:50:00.000Z'));
    expect(formatKstWallClockCompact(start)).toBe('20261009095000');
    expect(formatKstWallClockCompact(end)).toBe('20261009125000');
  });
});

describe('formatKstWallClockNaive', () => {
  // 센서 응답 timestamp(분 단위)와 비교하는 키라 초를 쓰지 않는다 — Compact와 역할이 다르다.
  it('분 단위 "YYYY-MM-DDTHH:mm:00"으로 포맷한다', () => {
    const d = kstWallClock(new Date('2026-10-09T00:50:00.000Z'));
    expect(formatKstWallClockNaive(d)).toBe('2026-10-09T09:50:00');
  });
});
