import { describe, expect, it } from 'vitest';
import {
  advanceTimelineFrame,
  clampTimelineFrameIndex,
  formatElapsedFrameTime,
  formatFrameDateTime,
  formatFrameTime,
  hourTickIndices,
  timelineTickMs,
} from './timeline.js';

describe('timelineTickMs', () => {
  it('배속만큼 프레임 간격이 짧아진다(1·3·10배)', () => {
    expect(timelineTickMs(1, 500)).toBe(500);
    expect(timelineTickMs(3, 500)).toBeCloseTo(166.67, 2);
    expect(timelineTickMs(10, 500)).toBe(50);
  });

  it('0 이하 배속은 기본 간격으로 본다', () => {
    expect(timelineTickMs(0, 500)).toBe(500);
    expect(timelineTickMs(-3, 500)).toBe(500);
  });
});

describe('advanceTimelineFrame', () => {
  it('재생 중이면 프레임을 1개 전진하고 playing을 유지한다', () => {
    expect(advanceTimelineFrame(0, 145)).toEqual({ frameIndex: 1, playing: true });
    expect(advanceTimelineFrame(143, 145)).toEqual({ frameIndex: 144, playing: true });
  });

  it('마지막 프레임에 도달하면 그 자리에서 멈춘다(반복 재생 없음)', () => {
    expect(advanceTimelineFrame(144, 145)).toEqual({ frameIndex: 144, playing: false });
  });

  it('frameCount가 0 이하면 0번에서 멈춘다', () => {
    expect(advanceTimelineFrame(0, 0)).toEqual({ frameIndex: 0, playing: false });
  });
});

describe('clampTimelineFrameIndex', () => {
  it('범위 안이면 그대로', () => {
    expect(clampTimelineFrameIndex(10, 145)).toBe(10);
  });

  it('범위를 벗어나면 끝 값으로 자른다', () => {
    expect(clampTimelineFrameIndex(-5, 145)).toBe(0);
    expect(clampTimelineFrameIndex(999, 145)).toBe(144);
  });

  it('frameCount가 0이면 0', () => {
    expect(clampTimelineFrameIndex(5, 0)).toBe(0);
  });
});

describe('formatFrameTime', () => {
  it('ISO 문자열에서 HH:mm만 뽑는다', () => {
    expect(formatFrameTime('2026-10-05T15:30:00+09:00')).toBe('15:30');
    expect(formatFrameTime('2026-10-05T00:00:00+09:00')).toBe('00:00');
  });

  it('형식이 이상하면 대시', () => {
    expect(formatFrameTime('not-a-date')).toBe('-');
  });
});

describe('hourTickIndices', () => {
  it('10분 간격 145프레임에서 1시간(6프레임)마다 인덱스를 고른다', () => {
    const ticks = hourTickIndices(145);
    expect(ticks[0]).toBe(0);
    expect(ticks[1]).toBe(6);
    expect(ticks[ticks.length - 1]).toBeLessThan(145);
  });

  it('frameCount가 0이면 빈 배열', () => {
    expect(hourTickIndices(0)).toEqual([]);
  });

  it('framesPerHour를 바꾸면 그 간격으로 고른다', () => {
    expect(hourTickIndices(10, 3)).toEqual([0, 3, 6, 9]);
  });
});

describe('formatFrameDateTime', () => {
  // 2026-10-13 온도 측 B-7: 타임라인 양 끝을 날짜 포함 실제 시각으로 표시한다.
  it('날짜까지 포함해 "MM/DD HH:mm"으로 만든다', () => {
    expect(formatFrameDateTime('2026-10-05T15:20:00+09:00')).toBe('10/05 15:20');
  });

  it('다음 날로 넘어간 마지막 프레임도 날짜가 드러난다', () => {
    expect(formatFrameDateTime('2026-10-06T15:20:00+09:00')).toBe('10/06 15:20');
  });

  it('형식이 아니면 "-"', () => {
    expect(formatFrameDateTime('bad')).toBe('-');
  });
});

describe('formatElapsedFrameTime', () => {
  it('10분 간격 145프레임이면 0 → 00:00, 144 → 24:00 (전문가 모드 라벨, 2026-10-17 시안)', () => {
    expect(formatElapsedFrameTime(0)).toBe('00:00');
    expect(formatElapsedFrameTime(144)).toBe('24:00');
  });

  it('중간 프레임은 경과 시간 HH:mm', () => {
    expect(formatElapsedFrameTime(1)).toBe('00:10');
    expect(formatElapsedFrameTime(6)).toBe('01:00');
    expect(formatElapsedFrameTime(100)).toBe('16:40');
  });

  it('음수는 0으로 본다', () => {
    expect(formatElapsedFrameTime(-5)).toBe('00:00');
  });
});
