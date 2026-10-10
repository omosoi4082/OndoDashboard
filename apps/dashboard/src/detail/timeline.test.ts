import { describe, expect, it } from 'vitest';
import { advanceTimelineFrame, clampTimelineFrameIndex, formatFrameTime, hourTickIndices } from './timeline.js';

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
