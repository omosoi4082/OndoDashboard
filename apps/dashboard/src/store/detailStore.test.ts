import { beforeEach, describe, expect, it } from 'vitest';
import { useDetailStore } from './detailStore.js';

describe('detailStore setMode', () => {
  beforeEach(() => {
    useDetailStore.getState().setMode('current');
  });

  it('resets the analysis field and speed when the mode changes', () => {
    useDetailStore.getState().setValueField('rh');
    useDetailStore.getState().setParticleSpeed(10);
    useDetailStore.getState().setMode('forecast');
    expect(useDetailStore.getState().particleSpeed).toBe(1);
    expect(useDetailStore.getState().valueField).toBe('temp');
  });
});

describe('detailStore setSectionZ', () => {
  it('단면 높이를 바꾸고, 모드를 바꾸면 기본 0.5 m로 돌아간다', () => {
    useDetailStore.getState().setMode('forecast');
    expect(useDetailStore.getState().sectionZ).toBe(0.5);
    useDetailStore.getState().setSectionZ(1.7);
    expect(useDetailStore.getState().sectionZ).toBe(1.7);
    useDetailStore.getState().setValueField('rh');
    expect(useDetailStore.getState().sectionZ).toBe(1.7);
    useDetailStore.getState().setMode('control');
    expect(useDetailStore.getState().sectionZ).toBe(0.5);
  });
});

describe('detailStore setValueField', () => {
  beforeEach(() => {
    useDetailStore.getState().setMode('forecast');
  });

  it('분석 항목을 누르면 처음부터 다시 재생한다', () => {
    useDetailStore.getState().setTimelineFrameIndex(7);
    useDetailStore.getState().pause();
    useDetailStore.getState().setValueField('rh');
    expect(useDetailStore.getState().timelineFrameIndex).toBe(0);
    expect(useDetailStore.getState().timelinePlaying).toBe(true);
  });

  it('보던 자리가 있어도 맨 처음으로 돌아가 다시 재생한다', () => {
    useDetailStore.getState().setTimelineFrameIndex(12);
    useDetailStore.getState().setValueField('rh');
    expect(useDetailStore.getState().timelineFrameIndex).toBe(0);
    expect(useDetailStore.getState().timelinePlaying).toBe(true);
  });

  it('온도로 돌아와도 똑같이 처음부터 재생한다', () => {
    useDetailStore.getState().setTimelineFrameIndex(30);
    useDetailStore.getState().setValueField('temp');
    expect(useDetailStore.getState().timelineFrameIndex).toBe(0);
    expect(useDetailStore.getState().timelinePlaying).toBe(true);
  });

  it('배속은 그대로 둔다(배속 버튼이 늘 보인다)', () => {
    useDetailStore.getState().setParticleSpeed(10);
    useDetailStore.getState().setValueField('rh');
    expect(useDetailStore.getState().particleSpeed).toBe(10);
  });

  it('입자를 빈 방부터 다시 내보낸다(runId 증가)', () => {
    const before = useDetailStore.getState().timelineRunId;
    useDetailStore.getState().setValueField('rh');
    expect(useDetailStore.getState().timelineRunId).toBe(before + 1);
  });

  it('현재 모드는 타임라인이 없어 재생되지 않는다', () => {
    useDetailStore.getState().setMode('current');
    useDetailStore.getState().setValueField('rh');
    expect(useDetailStore.getState().timelinePlaying).toBe(false);
  });
});

describe('detailStore 자동 재생', () => {
  it('예측·전문가·제어 모드에 들어가면 바로 재생한다', () => {
    for (const mode of ['forecast', 'expert', 'control'] as const) {
      useDetailStore.getState().setMode(mode);
      expect(useDetailStore.getState().timelinePlaying, mode).toBe(true);
      expect(useDetailStore.getState().timelineFrameIndex, mode).toBe(0);
    }
  });

  it('현재 모드는 타임라인이 없어 재생 상태가 꺼져 있다', () => {
    useDetailStore.getState().setMode('current');
    expect(useDetailStore.getState().timelinePlaying).toBe(false);
  });
});
