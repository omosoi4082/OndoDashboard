import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerMainWeatherKmaRoute } from './mainWeatherKma.js';
import type { KmaClient } from '../clients/kmaClient.js';
import type { ApiOk, KmaWeather } from '@ondo/shared';

const FARM_LAT = 33.446297;
const FARM_LON = 126.563879;

describe('GET /api/main/weather/kma', () => {
  it('초단기실황 정상 + PTY=0이면 초단기예보 SKY로 날씨 판정', async () => {
    const kmaClient: KmaClient = {
      async getUltraSrtNcst() {
        return {
          map: { T1H: '21.5', REH: '68', VEC: '227', PTY: '0' },
          baseAt: '2026-10-07T15:00:00+09:00',
        };
      },
      async getUltraSrtFcst() {
        return {
          items: [{ category: 'SKY', fcstDate: '20261007', fcstTime: '1530', fcstValue: '3' }],
          baseAt: '2026-10-07T14:30:00+09:00',
        };
      },
      async getVilageFcst() {
        return null;
      },
    };

    const app = Fastify();
    registerMainWeatherKmaRoute(app, { kmaClient, farmLat: FARM_LAT, farmLon: FARM_LON, areaName: '' });

    const res = await app.inject({ method: 'GET', url: '/api/main/weather/kma' });
    const body = res.json() as ApiOk<KmaWeather>;

    expect(body.status).toBe('ok');
    expect(body.data.sourceStatus).toBe('ok');
    expect(body.data.weatherCode).toBe('MOSTLY_CLOUDY'); // SKY=3
    expect(body.data.windDir).toBe('남서');
    expect(body.data.windDeg).toBe(227);
    expect(body.data.temp).toBe(21.5);

    await app.close();
  });

  it('초단기실황이 실패하면 disconnected, 전체 null', async () => {
    const kmaClient: KmaClient = {
      async getUltraSrtNcst() {
        return null;
      },
      async getUltraSrtFcst() {
        return null;
      },
      async getVilageFcst() {
        return null;
      },
    };

    const app = Fastify();
    registerMainWeatherKmaRoute(app, { kmaClient, farmLat: FARM_LAT, farmLon: FARM_LON, areaName: '' });

    const res = await app.inject({ method: 'GET', url: '/api/main/weather/kma' });
    const body = res.json() as ApiOk<KmaWeather>;

    expect(body.status).toBe('partial');
    expect(body.data.sourceStatus).toBe('disconnected');
    expect(body.data.temp).toBeNull();
    expect(body.data.weatherCode).toBeNull();

    await app.close();
  });

  it('PTY≠0이면 PTY 우선(SKY 무시)', async () => {
    const kmaClient: KmaClient = {
      async getUltraSrtNcst() {
        return { map: { T1H: '5', REH: '90', VEC: '100', PTY: '1' }, baseAt: '2026-10-07T15:00:00+09:00' };
      },
      async getUltraSrtFcst() {
        return { items: [{ category: 'SKY', fcstDate: '20261007', fcstTime: '1530', fcstValue: '1' }], baseAt: '' };
      },
      async getVilageFcst() {
        return null;
      },
    };

    const app = Fastify();
    registerMainWeatherKmaRoute(app, { kmaClient, farmLat: FARM_LAT, farmLon: FARM_LON, areaName: '' });

    const res = await app.inject({ method: 'GET', url: '/api/main/weather/kma' });
    const body = res.json() as ApiOk<KmaWeather>;
    expect(body.data.weatherCode).toBe('RAIN');

    await app.close();
  });
});
