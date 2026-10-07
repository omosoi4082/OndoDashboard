import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerMainWeatherStationRoute } from './mainWeatherStation.js';
import type { SensorClient } from '../clients/sensorClient.js';
import type { ApiOk, StationWeather } from '@ondo/shared';

const FARM_LAT = 33.446297;
const FARM_LON = 126.563879;

describe('GET /api/main/weather/station', () => {
  it('정상 응답이면 ok, 11~14시 SOLAR로 날씨 판정', async () => {
    const sensorClient: SensorClient = {
      async latest() {
        return {
          TEMP: { timestamp: '2026-10-07T12:00:00', value: 21.5 },
          RH: { timestamp: '2026-10-07T12:00:00', value: 68 },
          RAIN: { timestamp: '2026-10-07T12:00:00', value: 0 },
          SOLAR: { timestamp: '2026-10-07T12:00:00', value: 800 },
          WIND: { timestamp: '2026-10-07T12:00:00', value: 227 },
        };
      },
    };

    const app = Fastify();
    registerMainWeatherStationRoute(app, { sensorClient, farmLat: FARM_LAT, farmLon: FARM_LON });

    const res = await app.inject({ method: 'GET', url: '/api/main/weather/station' });
    const body = res.json() as ApiOk<StationWeather>;

    expect(body.status).toBe('ok');
    expect(body.data.sourceStatus).toBe('ok');
    expect(body.data.weatherCode).toBe('CLEAR');
    expect(body.data.windDir).toBe('남서');
    expect(body.data.windDeg).toBe(227);
    expect(body.data.measuredAt).toBe('2026-10-07T12:00:00+09:00');

    await app.close();
  });

  it('WS1 전체가 끊기면 disconnected, 모든 값 null', async () => {
    const sensorClient: SensorClient = {
      async latest() {
        return null;
      },
    };

    const app = Fastify();
    registerMainWeatherStationRoute(app, { sensorClient, farmLat: FARM_LAT, farmLon: FARM_LON });

    const res = await app.inject({ method: 'GET', url: '/api/main/weather/station' });
    const body = res.json() as ApiOk<StationWeather>;

    expect(body.status).toBe('partial');
    expect(body.data.sourceStatus).toBe('disconnected');
    expect(body.data.temp).toBeNull();
    expect(body.data.weatherCode).toBeNull();

    await app.close();
  });

  it('11~14시 밖이고 비가 없으면 weatherCode null', async () => {
    const sensorClient: SensorClient = {
      async latest() {
        return {
          TEMP: { timestamp: '2026-10-07T20:00:00', value: 18.0 },
          RAIN: { timestamp: '2026-10-07T20:00:00', value: 0 },
          SOLAR: { timestamp: '2026-10-07T20:00:00', value: 0 },
        };
      },
    };

    const app = Fastify();
    registerMainWeatherStationRoute(app, { sensorClient, farmLat: FARM_LAT, farmLon: FARM_LON });

    const res = await app.inject({ method: 'GET', url: '/api/main/weather/station' });
    const body = res.json() as ApiOk<StationWeather>;
    expect(body.data.weatherCode).toBeNull();

    await app.close();
  });
});
