import { beforeEach, describe, expect, it } from 'vitest';
import { useDetailStore } from './detailStore.js';

describe('detailStore setMode', () => {
  beforeEach(() => {
    useDetailStore.getState().setMode('current');
  });

  it('resets the particle color and speed when the mode changes', () => {
    useDetailStore.getState().setValueField('flow');
    useDetailStore.getState().setParticleColorField('rh');
    useDetailStore.getState().setParticleSpeed(10);
    useDetailStore.getState().setMode('forecast');
    expect(useDetailStore.getState().particleColorField).toBe('temp');
    expect(useDetailStore.getState().particleSpeed).toBe(3);
    expect(useDetailStore.getState().valueField).toBe('temp');
  });
});
