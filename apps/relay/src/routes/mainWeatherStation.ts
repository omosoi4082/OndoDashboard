// docs/02-relay-api.md 4.3 GET /api/main/weather/station
import type { FastifyInstance } from 'fastify';
import type { ApiOk, SourceStatus, StationWeather } from '@ondo/shared';
import type { SensorClient } from '../clients/sensorClient.js';
import { stationWeatherCode } from '../transforms/weatherCode.js';
import { stationWindKmhToMs } from '../transforms/stationWind.js';
import { resolveWind } from '../transforms/windDirection.js';
import { isNightAt } from '../transforms/sunTimes.js';
import { latestIso, nowKstIso, toKstIso, toNumberOrNull } from '../utils/time.js';

const WS1_PATH = 'JE/OU/WS/WS1';

function hourFromKstIso(iso: string): number {
  // "2026-10-05T15:28:10+09:00" → 15
  return Number(iso.slice(11, 13));
}

export function registerMainWeatherStationRoute(
  app: FastifyInstance,
  deps: { sensorClient: SensorClient; farmLat: number; farmLon: number },
): void {
  app.get('/api/main/weather/station', async (): Promise<ApiOk<StationWeather>> => {
    const requestedAt = nowKstIso();
    const now = new Date();

    const device = await deps.sensorClient.latest(WS1_PATH);
    const sourceStatus: SourceStatus = device !== null ? 'ok' : 'disconnected';

    const tempItem = device?.['TEMP'];
    const rhItem = device?.['RH'];
    const rainItem = device?.['RAIN'];
    const solarItem = device?.['SOLAR'];
    const windItem = device?.['WIND'];
    // 풍속 타일은 현재 풍속 CURWIND를 쓴다(MAXWIND는 쓰지 않음 — 05-open-questions #36).
    // 센서 값은 km/h라 m/s로 환산해 내보낸다(transforms/stationWind.ts에 경위와 근거).
    // 2026-10-15 온도 측은 "m/s가 맞다"고 답했지만, 2026-10-17 실측(맑은 날 MAXWIND 32)이
    // 그 답과 맞지 않아 사용자 결정으로 환산을 넣었다 — 다음 회신에서 재확인받는다(#43).
    const windSpeedItem = device?.['CURWIND'];

    const temp = tempItem ? toNumberOrNull(tempItem.value) : null;
    const rh = rhItem ? toNumberOrNull(rhItem.value) : null;
    const rain = rainItem ? toNumberOrNull(rainItem.value) : null;
    const solar = solarItem ? toNumberOrNull(solarItem.value) : null;
    const wind = windItem ? resolveWind(windItem.value) : { windDir: null, windDeg: null };
    const windSpeed = windSpeedItem ? stationWindKmhToMs(toNumberOrNull(windSpeedItem.value)) : null;

    const timestamps = [tempItem, rhItem, rainItem, solarItem, windItem, windSpeedItem].map((item) =>
      item ? toKstIso(item.timestamp) : null,
    );
    const measuredAt = latestIso(timestamps);
    const hour = measuredAt !== null ? hourFromKstIso(measuredAt) : kstHourNow(now);

    const weatherCode = stationWeatherCode({ rain, solar, hour });

    const data: StationWeather = {
      label: '미세기후',
      sourceStatus,
      measuredAt,
      weatherCode,
      isNight: isNightAt(now, deps.farmLat, deps.farmLon),
      windDir: wind.windDir,
      windDeg: wind.windDeg,
      windSpeed,
      temp,
      rh,
      rain,
      solar,
    };

    return {
      status: sourceStatus === 'ok' ? 'ok' : 'partial',
      requestedAt,
      data,
    };
  });
}

function kstHourNow(now: Date): number {
  return Number(nowKstIso(now).slice(11, 13));
}
