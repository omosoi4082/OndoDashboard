// docs/02-relay-api.md 4.2 GET /api/main/weather/kma
import type { FastifyInstance } from 'fastify';
import type { ApiOk, KmaWeather, SourceStatus } from '@ondo/shared';
import type { KmaClient } from '../clients/kmaClient.js';
import { pickNearestFcstValue } from '../clients/kmaParse.js';
import { kmaWeatherCode } from '../transforms/weatherCode.js';
import { resolveWind } from '../transforms/windDirection.js';
import { isNightAt } from '../transforms/sunTimes.js';
import { kstWallClock, nowKstIso, toNumberOrNull } from '../utils/time.js';

export function registerMainWeatherKmaRoute(
  app: FastifyInstance,
  deps: { kmaClient: KmaClient; farmLat: number; farmLon: number },
): void {
  app.get('/api/main/weather/kma', async (): Promise<ApiOk<KmaWeather>> => {
    const requestedAt = nowKstIso();
    const now = new Date();

    const [ncstResult, fcstResult] = await Promise.allSettled([
      deps.kmaClient.getUltraSrtNcst(now),
      deps.kmaClient.getUltraSrtFcst(now),
    ]);
    const ncst = ncstResult.status === 'fulfilled' ? ncstResult.value : null;
    const fcst = fcstResult.status === 'fulfilled' ? fcstResult.value : null;

    const pty = ncst ? toNumberOrNull(ncst.map['PTY']) : null;
    const sky = fcst ? toNumberOrNull(pickNearestFcstValue(fcst.items, 'SKY', kstWallClock(now))) : null;
    const weatherCode = kmaWeatherCode(pty, sky);

    const vec = ncst ? toNumberOrNull(ncst.map['VEC']) : null;
    const wind = resolveWind(vec);

    const temp = ncst ? toNumberOrNull(ncst.map['T1H']) : null;
    const rh = ncst ? toNumberOrNull(ncst.map['REH']) : null;

    // 초단기실황(온도·습도·풍향의 출처)이 핵심이므로 그 성패로 sourceStatus를 정한다.
    // 초단기예보(SKY) 실패는 PTY≠0인 한 영향 없고, PTY=0인데 SKY도 없으면 weatherCode만 null이 된다.
    const sourceStatus: SourceStatus = ncst !== null ? 'ok' : 'disconnected';

    const data: KmaWeather = {
      label: '기상청 실황',
      sourceStatus,
      baseAt: ncst ? ncst.baseAt : null,
      weatherCode,
      isNight: isNightAt(now, deps.farmLat, deps.farmLon),
      windDir: wind.windDir,
      windDeg: wind.windDeg,
      temp,
      rh,
    };

    return {
      status: sourceStatus === 'ok' ? 'ok' : 'partial',
      requestedAt,
      data,
    };
  });
}
