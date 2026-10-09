import { describe, expect, it } from 'vitest';
import { completedTenMinuteWindow, fiveMinuteMarks, minuteMarks } from './currentWindow.js';

// kstWallClock() 변환 결과를 흉내 낸다: UTC 필드 = KST 벽시계 값.
function kst(y: number, m: number, d: number, h: number, mi: number, s = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, mi, s));
}

describe('completedTenMinuteWindow', () => {
  it('docs 예시: 15:26 → 끝 15:20, 시작 12:20', () => {
    const { startMin, endMin } = completedTenMinuteWindow(kst(2026, 10, 7, 15, 26));
    expect(endMin).toEqual(kst(2026, 10, 7, 15, 20));
    expect(startMin).toEqual(kst(2026, 10, 7, 12, 20));
  });

  it('docs 예시: 15:20:30 → 끝 15:10(15:20분은 아직 안 끝남)', () => {
    const { startMin, endMin } = completedTenMinuteWindow(kst(2026, 10, 7, 15, 20, 30));
    expect(endMin).toEqual(kst(2026, 10, 7, 15, 10));
    expect(startMin).toEqual(kst(2026, 10, 7, 12, 10));
  });

  it('정각 경계: 15:20:00(초 0) → 끝 15:10 (15:20분이 막 시작, 아직 안 끝남)', () => {
    const { endMin } = completedTenMinuteWindow(kst(2026, 10, 7, 15, 20, 0));
    expect(endMin).toEqual(kst(2026, 10, 7, 15, 10));
  });

  it('15:21:00 → 끝 15:20 (15:20분이 막 완료됨)', () => {
    const { endMin } = completedTenMinuteWindow(kst(2026, 10, 7, 15, 21, 0));
    expect(endMin).toEqual(kst(2026, 10, 7, 15, 20));
  });

  it('자정 넘김: 00:06 → 끝 00:00, 시작은 전날 21:00', () => {
    const { startMin, endMin } = completedTenMinuteWindow(kst(2026, 10, 7, 0, 6));
    expect(endMin).toEqual(kst(2026, 10, 7, 0, 0));
    expect(startMin).toEqual(kst(2026, 10, 6, 21, 0));
  });

  it('월 경계도 넘는다: 11/1 00:06 → 시작 10/31 21:00', () => {
    const { startMin, endMin } = completedTenMinuteWindow(kst(2026, 11, 1, 0, 6));
    expect(endMin).toEqual(kst(2026, 11, 1, 0, 0));
    expect(startMin).toEqual(kst(2026, 10, 31, 21, 0));
  });
});

describe('minuteMarks', () => {
  it('180분 구간이면 181개(1분 간격)', () => {
    const marks = minuteMarks(kst(2026, 10, 7, 12, 20), kst(2026, 10, 7, 15, 20));
    expect(marks).toHaveLength(181);
    expect(marks[0]).toEqual(kst(2026, 10, 7, 12, 20));
    expect(marks[180]).toEqual(kst(2026, 10, 7, 15, 20));
  });
});

describe('fiveMinuteMarks', () => {
  it('180분 구간이면 37개(5분 간격)', () => {
    const marks = fiveMinuteMarks(kst(2026, 10, 7, 12, 20), kst(2026, 10, 7, 15, 20));
    expect(marks).toHaveLength(37);
    expect(marks[0]).toEqual(kst(2026, 10, 7, 12, 20));
    expect(marks[36]).toEqual(kst(2026, 10, 7, 15, 20));
  });
});
