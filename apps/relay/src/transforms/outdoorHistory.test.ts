import { describe, expect, it } from 'vitest';
import { completedTenMinuteWindow, fiveMinuteMarks } from './currentWindow.js';
import { outdoorFiveMinuteSeries, outdoorHourMarks, parseObservedValue } from './outdoorHistory.js';

// kstWallClock() 표현을 흉내 낸다: UTC 필드 = KST 벽시계 값.
function kst(y: number, m: number, d: number, h: number, mi = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, mi));
}

function hhmm(d: Date): string {
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
}

describe('outdoorHourMarks', () => {
  it('12:20~15:20 구간은 12·13·14·15시 4개', () => {
    const window = completedTenMinuteWindow(kst(2026, 10, 14, 15, 26));
    expect(outdoorHourMarks(window).map(hhmm)).toEqual(['12:00', '13:00', '14:00', '15:00']);
  });

  it('끝이 정시여도 4개(12:00~15:00)', () => {
    const window = completedTenMinuteWindow(kst(2026, 10, 14, 15, 5));
    expect(outdoorHourMarks(window).map(hhmm)).toEqual(['12:00', '13:00', '14:00', '15:00']);
  });

  it('자정을 넘기면 전날 시각이 섞인다', () => {
    const window = completedTenMinuteWindow(kst(2026, 10, 14, 1, 15)); // 22:10~01:10
    const marks = outdoorHourMarks(window);
    expect(marks.map(hhmm)).toEqual(['22:00', '23:00', '00:00', '01:00']);
    expect(marks[0]?.getUTCDate()).toBe(13);
    expect(marks[3]?.getUTCDate()).toBe(14);
  });
});

describe('parseObservedValue', () => {
  it('숫자 문자열을 그대로 숫자로', () => {
    expect(parseObservedValue('17.6', -30, 50)).toBe(17.6);
  });

  it('비었거나 숫자가 아니거나 범위 밖(결측 표기 −998.9)이면 null', () => {
    expect(parseObservedValue(undefined, -30, 50)).toBeNull();
    expect(parseObservedValue('', -30, 50)).toBeNull();
    expect(parseObservedValue('abc', -30, 50)).toBeNull();
    expect(parseObservedValue('-998.9', -30, 50)).toBeNull();
    expect(parseObservedValue('101', 0, 100)).toBeNull();
  });
});

describe('outdoorFiveMinuteSeries', () => {
  // 12:20~15:20, 정시 12·13·14·15.
  const window = completedTenMinuteWindow(kst(2026, 10, 14, 15, 26));
  const hours = outdoorHourMarks(window);
  const marks = fiveMinuteMarks(window.startMin, window.endMin);

  function valueAt(values: number[], h: number, mi: number): number | undefined {
    const idx = marks.findIndex((m) => m.getUTCHours() === h && m.getUTCMinutes() === mi);
    return values[idx];
  }

  it('정시 사이는 선형 보간, 마지막 관측 이후는 마지막 값 유지(37건)', () => {
    const r = outdoorFiveMinuteSeries(hours, [10, 16, 22, 28], marks);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values).toHaveLength(37);
    expect(valueAt(r.values, 12, 20)).toBeCloseTo(12);
    expect(valueAt(r.values, 13, 0)).toBe(16);
    expect(valueAt(r.values, 13, 30)).toBeCloseTo(19);
    expect(valueAt(r.values, 15, 0)).toBe(28);
    expect(valueAt(r.values, 15, 20)).toBe(28);
  });

  it('사이 결측 1개는 앞뒤 보간', () => {
    const r = outdoorFiveMinuteSeries(hours, [10, null, 22, 28], marks);
    expect(r.ok && valueAt(r.values, 13, 0)).toBe(16);
  });

  it('맨 뒤 결측 1개(아직 발표 전)는 직전 값 유지', () => {
    const r = outdoorFiveMinuteSeries(hours, [10, 16, 22, null], marks);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(valueAt(r.values, 14, 30)).toBe(22);
    expect(valueAt(r.values, 15, 20)).toBe(22);
  });

  it('맨 앞 결측 1개는 다음 값으로 채운다', () => {
    const r = outdoorFiveMinuteSeries(hours, [null, 16, 22, 28], marks);
    expect(r.ok && valueAt(r.values, 12, 20)).toBe(16);
  });

  it('떨어진 결측 2개(연속 아님)는 각각 채운다', () => {
    const r = outdoorFiveMinuteSeries(hours, [null, 16, null, 28], marks);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(valueAt(r.values, 14, 0)).toBe(22);
  });

  it('연속 결측 2개 이상이면 실패', () => {
    expect(outdoorFiveMinuteSeries(hours, [10, null, null, 28], marks).ok).toBe(false);
    expect(outdoorFiveMinuteSeries(hours, [10, 16, null, null], marks).ok).toBe(false);
    expect(outdoorFiveMinuteSeries(hours, [null, null, null, null], marks).ok).toBe(false);
  });

  it('자정을 넘겨도 시각 순서대로 보간한다', () => {
    const w = completedTenMinuteWindow(kst(2026, 10, 14, 1, 15)); // 22:10~01:10
    const h = outdoorHourMarks(w);
    const m = fiveMinuteMarks(w.startMin, w.endMin);
    const r = outdoorFiveMinuteSeries(h, [20, 18, 16, 14], m);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const midnightIdx = m.findIndex((x) => x.getUTCHours() === 0 && x.getUTCMinutes() === 0);
    expect(r.values[midnightIdx]).toBe(16);
    expect(r.values[midnightIdx + 6]).toBeCloseTo(15); // 00:30
    expect(r.values[r.values.length - 1]).toBe(14); // 01:10 — 마지막 값 유지
  });
});
