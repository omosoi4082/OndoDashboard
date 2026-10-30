import { describe, expect, it } from 'vitest';
import {
  advanceTimelineFrame,
  clampTimelineFrameIndex,
  formatElapsedFrameTime,
  formatFrameDateTime,
  formatFrameTime,
  hourTickIndices,
  timelineCatchupSteps,
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

  // 2026-10-30 B-3-12 — 틱이 밀리면 한 번에 여러 프레임을 건너뛴다.
  it('steps만큼 한 번에 전진한다', () => {
    expect(advanceTimelineFrame(0, 145, 3)).toEqual({ frameIndex: 3, playing: true });
    expect(advanceTimelineFrame(10, 145, 20)).toEqual({ frameIndex: 30, playing: true });
  });

  it('건너뛴 결과가 끝을 넘으면 마지막 프레임에서 멈춘다', () => {
    expect(advanceTimelineFrame(140, 145, 20)).toEqual({ frameIndex: 144, playing: false });
  });

  it('steps가 0이나 음수여도 최소 1프레임은 전진한다(멈춤 방지)', () => {
    expect(advanceTimelineFrame(0, 145, 0)).toEqual({ frameIndex: 1, playing: true });
    expect(advanceTimelineFrame(0, 145, -5)).toEqual({ frameIndex: 1, playing: true });
  });
});

describe('timelineCatchupSteps', () => {
  it('제때 울린 틱은 1프레임만 전진한다', () => {
    expect(timelineCatchupSteps(500, 500, 1_000)).toEqual({ steps: 1, remainderMs: 0 });
    expect(timelineCatchupSteps(50, 50, 1_000)).toEqual({ steps: 1, remainderMs: 0 });
  });

  // 온도 측 점검 PC에서 10배(틱 50ms)인데 실제로는 약 143ms마다 울렸다 → 2프레임 + 나머지 43ms.
  it('틱이 밀린 만큼 여러 프레임을 건너뛴다', () => {
    const { steps, remainderMs } = timelineCatchupSteps(143, 50, 1_000);
    expect(steps).toBe(2);
    expect(remainderMs).toBeCloseTo(43, 6);
  });

  it('한 프레임이 안 됐으면 전진하지 않고 나머지로 남긴다', () => {
    expect(timelineCatchupSteps(30, 50, 1_000)).toEqual({ steps: 0, remainderMs: 30 });
  });

  it('탭을 오래 가려 둬도 상한까지만 따라잡는다(끝으로 순간이동 방지)', () => {
    expect(timelineCatchupSteps(60_000, 50, 1_000)).toEqual({ steps: 20, remainderMs: 0 });
    expect(timelineCatchupSteps(60_000, 500, 1_000)).toEqual({ steps: 2, remainderMs: 0 });
  });

  it('경과·간격이 0 이하면 전진하지 않는다', () => {
    expect(timelineCatchupSteps(0, 50, 1_000)).toEqual({ steps: 0, remainderMs: 0 });
    expect(timelineCatchupSteps(100, 0, 1_000)).toEqual({ steps: 0, remainderMs: 0 });
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
