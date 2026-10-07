import { describe, expect, it } from 'vitest';
import { degToCompass16, resolveWind } from './windDirection.js';

describe('degToCompass16', () => {
  it('0도는 북', () => {
    expect(degToCompass16(0)).toBe('북');
  });

  it('348.75도(하한 포함)는 북', () => {
    expect(degToCompass16(348.75)).toBe('북');
  });

  it('11.24도는 아직 북', () => {
    expect(degToCompass16(11.24)).toBe('북');
  });

  it('11.25도(상한)부터는 북북동', () => {
    expect(degToCompass16(11.25)).toBe('북북동');
  });

  it('90도는 동', () => {
    expect(degToCompass16(90)).toBe('동');
  });

  it('180도는 남', () => {
    expect(degToCompass16(180)).toBe('남');
  });

  it('270도는 서', () => {
    expect(degToCompass16(270)).toBe('서');
  });

  it('359.99도는 북(경계 바로 아래)', () => {
    expect(degToCompass16(359.99)).toBe('북');
  });

  it('360도 이상도 정규화된다', () => {
    expect(degToCompass16(720 + 90)).toBe('동');
  });

  it('음수 각도도 정규화된다', () => {
    expect(degToCompass16(-90)).toBe('서');
  });
});

describe('resolveWind', () => {
  it('숫자면 각도→16방위 변환, windDeg 보존', () => {
    expect(resolveWind(90)).toEqual({ windDir: '동', windDeg: 90 });
  });

  it('문자열이면 그대로 통과, windDeg는 null', () => {
    expect(resolveWind('N')).toEqual({ windDir: 'N', windDeg: null });
  });

  it('null이면 둘 다 null', () => {
    expect(resolveWind(null)).toEqual({ windDir: null, windDeg: null });
  });
});
