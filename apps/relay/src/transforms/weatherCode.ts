// docs/03-upstream-apis.md 3장 "날씨 코드" + docs/05-open-questions.md #14(2026-10-07 확정)
// 순수 함수 + 단위 테스트(weatherCode.test.ts).
import type { WeatherCode } from '@ondo/shared';

/** PTY(강수형태) → WeatherCode. PTY=0(없음)이거나 알 수 없는 값이면 null(호출부가 SKY로 대체 판정). */
export function ptyToWeatherCode(pty: number): WeatherCode | null {
  if (pty === 1 || pty === 5) return 'RAIN';
  if (pty === 2 || pty === 6) return 'RAIN_SNOW';
  if (pty === 3 || pty === 7) return 'SNOW';
  return null;
}

/** SKY(하늘상태) → WeatherCode. 1=맑음, 3=구름많음, 4=흐림. (SKY=2는 기상청 코드에 없음) */
export function skyToWeatherCode(sky: number): WeatherCode | null {
  if (sky === 1) return 'CLEAR';
  if (sky === 3) return 'MOSTLY_CLOUDY';
  if (sky === 4) return 'OVERCAST';
  return null;
}

/**
 * 3-1 기상청 실황 날씨 코드 결정(docs/03 3장): PTY≠0이면 PTY 우선.
 * PTY=0(또는 null)이면 가장 가까운 fcstTime의 SKY. 둘 다 실패하면 null.
 */
export function kmaWeatherCode(pty: number | null, sky: number | null): WeatherCode | null {
  if (pty !== null && pty !== 0) {
    return ptyToWeatherCode(pty);
  }
  if (sky !== null) {
    return skyToWeatherCode(sky);
  }
  return null;
}

/**
 * 3-2 미세기후 날씨 코드 결정(docs/03 3장, 2026-10-07 온도 측 답변으로 확정 — 미확정 아님):
 * - RAIN > 0이면 시간 무관 RAIN.
 * - 그 외에는 11:00~14:00 측정값에만 SOLAR로 판정(CLEAR/PARTLY_CLOUDY/MOSTLY_CLOUDY/OVERCAST).
 * - 그 밖의 시간대는 weatherCode null.
 * hour: 측정 시각의 KST 시(0~23). [11,14) 구간만 판정 대상으로 본다.
 */
export function stationWeatherCode(params: {
  rain: number | null;
  solar: number | null;
  hour: number;
}): WeatherCode | null {
  const { rain, solar, hour } = params;

  if (rain !== null && rain > 0) {
    return 'RAIN';
  }

  const inSolarWindow = hour >= 11 && hour < 14;
  if (inSolarWindow && solar !== null) {
    if (solar >= 700) return 'CLEAR';
    if (solar >= 400) return 'PARTLY_CLOUDY';
    if (solar >= 150) return 'MOSTLY_CLOUDY';
    return 'OVERCAST';
  }

  return null;
}
