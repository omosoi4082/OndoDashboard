// docs/02-relay-api.md 4.3 GET /api/main/weather/station
import type { FastifyInstance } from 'fastify';
import type { ApiOk, SourceStatus, StationWeather } from '@ondo/shared';
import type { SensorClient } from '../clients/sensorClient.js';
import { stationWeatherCode } from '../transforms/weatherCode.js';
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

    const temp = tempItem ? toNumberOrNull(tempItem.value) : null;
    const rh = rhItem ? toNumberOrNull(rhItem.value) : null;
    const rain = rainItem ? toNumberOrNull(rainItem.value) : null;
    const solar = solarItem ? toNumberOrNull(solarItem.value) : null;
    const wind = windItem ? resolveWind(windItem.value) : { windDir: null, windDeg: null };

    const timestamps = [tempItem, rhItem, rainItem, solarItem, windItem].map((item) =>
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
