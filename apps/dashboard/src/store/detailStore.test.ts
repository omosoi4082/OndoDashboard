import { beforeEach, describe, expect, it } from 'vitest';
import { useDetailStore } from './detailStore.js';

describe('detailStore setMode', () => {
  beforeEach(() => {
    useDetailStore.getState().setMode('current');
  });

  it('resets the particle color and speed when the mode changes', () => {
    useDetailStore.getState().setValueField('flow');
    useDetailStore.getState().setParticleColorField('rh');
    useDetailStore.getState().setParticleSpeed(1);
    useDetailStore.getState().setMode('forecast');
    expect(useDetailStore.getState().particleColorField).toBe('temp');
    expect(useDetailStore.getState().particleSpeed).toBe(10);
    expect(useDetailStore.getState().valueField).toBe('temp');
  });
});

describe('detailStore setValueField', () => {
  beforeEach(() => {
    useDetailStore.getState().setMode('forecast');
  });

  it('분석 항목을 누르면 처음부터 다시 재생한다', () => {
    useDetailStore.getState().setTimelineFrameIndex(7);
    useDetailStore.getState().pause();
    useDetailStore.getState().setValueField('flow');
    expect(useDetailStore.getState().timelineFrameIndex).toBe(0);
    expect(useDetailStore.getState().timelinePlaying).toBe(true);
  });

  it('보던 자리가 있어도 맨 처음으로 돌아가 다시 재생한다', () => {
    useDetailStore.getState().setTimelineFrameIndex(12);
    useDetailStore.getState().setValueField('flow');
    expect(useDetailStore.getState().timelineFrameIndex).toBe(0);
    expect(useDetailStore.getState().timelinePlaying).toBe(true);
  });

  it('온도·습도도 똑같이 처음부터 재생한다', () => {
    useDetailStore.getState().setTimelineFrameIndex(30);
    useDetailStore.getState().setValueField('rh');
    expect(useDetailStore.getState().timelineFrameIndex).toBe(0);
    expect(useDetailStore.getState().timelinePlaying).toBe(true);
  });

  it('현재 모드는 타임라인이 없어 재생되지 않는다', () => {
    useDetailStore.getState().setMode('current');
    useDetailStore.getState().setValueField('flow');
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
