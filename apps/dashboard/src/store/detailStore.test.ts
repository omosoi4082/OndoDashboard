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

  it('유동을 고르면 타임라인이 맨 처음일 때 재생을 시작한다', () => {
    expect(useDetailStore.getState().timelinePlaying).toBe(false);
    useDetailStore.getState().setValueField('flow');
    expect(useDetailStore.getState().timelinePlaying).toBe(true);
  });

  it('보던 자리가 있으면(맨 처음이 아니면) 재생을 건드리지 않는다', () => {
    useDetailStore.getState().setTimelineFrameIndex(12);
    useDetailStore.getState().setValueField('flow');
    expect(useDetailStore.getState().timelinePlaying).toBe(false);
  });

  it('온도·습도를 고르면 재생 상태를 바꾸지 않는다', () => {
    useDetailStore.getState().setValueField('rh');
    expect(useDetailStore.getState().timelinePlaying).toBe(false);
  });

  it('현재 모드는 타임라인이 없어 재생되지 않는다', () => {
    useDetailStore.getState().setMode('current');
    useDetailStore.getState().setValueField('flow');
    expect(useDetailStore.getState().timelinePlaying).toBe(false);
  });
});
