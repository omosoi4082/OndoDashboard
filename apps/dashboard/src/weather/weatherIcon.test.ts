import { describe, expect, it } from 'vitest';
import { getWeatherIcon } from './weatherIcon.js';

describe('getWeatherIcon', () => {
  it('weatherCode가 null이면 null(호출 측에서 - 표시)', () => {
    expect(getWeatherIcon(null, false)).toBeNull();
  });

  it('CLEAR + 낮이면 맑음 아이콘', () => {
    expect(getWeatherIcon('CLEAR', false)?.src).toBe('/assets/icons/weather/clear.png');
  });

  it('CLEAR + 밤이면 밤(달) 아이콘(선택 2종 중 하나)', () => {
    expect(getWeatherIcon('CLEAR', true)?.src).toBe('/assets/icons/weather/clear-night.png');
  });

  it('PARTLY_CLOUDY는 밤이어도 밤 버전이 없어 낮 아이콘 그대로', () => {
    expect(getWeatherIcon('PARTLY_CLOUDY', true)).toEqual(getWeatherIcon('PARTLY_CLOUDY', false));
  });

  it('SNOW는 눈 아이콘', () => {
    expect(getWeatherIcon('SNOW', false)?.src).toBe('/assets/icons/weather/snow.png');
  });

  it('필수 7종 모두 아이콘이 있다', () => {
    const codes = ['CLEAR', 'PARTLY_CLOUDY', 'MOSTLY_CLOUDY', 'OVERCAST', 'RAIN', 'RAIN_SNOW', 'SNOW'] as const;
    for (const code of codes) {
      expect(getWeatherIcon(code, false)).not.toBeNull();
    }
  });
});
