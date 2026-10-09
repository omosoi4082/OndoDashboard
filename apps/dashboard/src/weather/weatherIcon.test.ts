import { Moon, Sun } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { getWeatherIcon } from './weatherIcon.js';

describe('getWeatherIcon', () => {
  it('weatherCode가 null이면 null(호출 측에서 - 표시)', () => {
    expect(getWeatherIcon(null, false)).toBeNull();
  });

  it('CLEAR + 낮이면 Sun', () => {
    expect(getWeatherIcon('CLEAR', false)?.Icon).toBe(Sun);
  });

  it('CLEAR + 밤이면 Moon(선택 2종 중 하나)', () => {
    expect(getWeatherIcon('CLEAR', true)?.Icon).toBe(Moon);
  });

  it('PARTLY_CLOUDY는 밤이어도 밤 버전이 없어 낮 아이콘 그대로', () => {
    const day = getWeatherIcon('PARTLY_CLOUDY', false);
    const night = getWeatherIcon('PARTLY_CLOUDY', true);
    expect(night?.Icon).toBe(day?.Icon);
  });

  it('필수 7종 모두 아이콘이 있다', () => {
    const codes = ['CLEAR', 'PARTLY_CLOUDY', 'MOSTLY_CLOUDY', 'OVERCAST', 'RAIN', 'RAIN_SNOW', 'SNOW'] as const;
    for (const code of codes) {
      expect(getWeatherIcon(code, false)).not.toBeNull();
    }
  });
});
