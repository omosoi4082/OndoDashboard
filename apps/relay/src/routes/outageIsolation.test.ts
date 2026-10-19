/**
 * 영역별 끊김 격리 테스트 (M7-5, docs/04-tasks.md).
 *
 * CLAUDE.md 규칙: "상위 서버 실패는 전체 실패로 만들지 않는다. 받은 값은 표시하고, 실패한
 * 항목만 `sourceStatus: 'disconnected'`로 응답해 화면에 끊김을 표시한다."
 *
 * 라우트별 테스트는 각자 "자기 상위 서버가 죽으면 disconnected"를 이미 확인한다. 여기서
 * 보는 것은 그 반대편이다 — **한 상위 서버가 죽었을 때 나머지 영역이 멀쩡한지**. 메인 화면은
 * 영역별 API 3개로 나뉘어 있어서(CLAUDE.md: "하나로 합치지 않는다") 한 곳의 실패가 다른
 * 영역으로 번지면 안 된다. 2026-10-23 온도 측 테스트에서 센서·기상청·연산 서버를 각각
 * 차단해 볼 때 기대해야 할 동작이 이것이다.
 *
 * 세 라우트를 한 앱에 같이 올려 실제 배선에 가깝게 둔다.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';
import type { ApiOk, Health, KmaWeather, RoomsResponse, StationWeather } from '@ondo/shared';
import { registerHealthRoute } from './health.js';
import { registerMainRoomsRoute } from './mainRooms.js';
import { registerMainWeatherKmaRoute } from './mainWeatherKma.js';
import { registerMainWeatherStationRoute } from './mainWeatherStation.js';
import type { SensorClient } from '../clients/sensorClient.js';
import type { SensorDevice } from '../clients/sensorParse.js';
import type { KmaClient } from '../clients/kmaClient.js';
import type { ComputeClient } from '../clients/computeClient.js';

const FARM_LAT = 33.446297;
const FARM_LON = 126.563879;

/** 모든 센서 경로에 값을 주는 정상 센서. 기상대(WS1)와 방 센서를 경로로 구분한다. */
const liveSensor: SensorClient = {
  async latest(devicePath: string): Promise<SensorDevice | null> {
    if (devicePath.includes('WS1')) {
      return {
        TEMP: { timestamp: '2026-10-17T10:00:00', value: 22.3 },
        RH: { timestamp: '2026-10-17T10:00:00', value: 76.7 },
        RAIN: { timestamp: '2026-10-17T10:00:00', value: 0 },
        SOLAR: { timestamp: '2026-10-17T10:00:00', value: 897 },
        WIND: { timestamp: '2026-10-17T10:00:00', value: 108 },
        CURWIND: { timestamp: '2026-10-17T10:00:00', value: 14 },
      };
    }
    return {
      TEMP: { timestamp: '2026-10-17T10:00:00', value: 27.6 },
      RH: { timestamp: '2026-10-17T10:00:00', value: 61 },
      NH3: { timestamp: '2026-10-17T10:00:00', value: 5 },
      CO2: { timestamp: '2026-10-17T10:00:00', value: 584 },
      FAN1: { timestamp: '2026-10-17T10:00:00', value: 64 },
    };
  },
};

/** 센서 서버 전체 차단 — 모든 경로가 null(네트워크 실패와 같은 모양). */
const deadSensor: SensorClient = {
  async latest() {
    return null;
  },
};

const liveKma: KmaClient = {
  async getUltraSrtNcst() {
    return {
      map: { T1H: '23.3', REH: '66', VEC: '70', PTY: '0', WSD: '3.7', RN1: '0' },
      baseAt: '2026-10-17T10:00:00+09:00',
    };
  },
  async getUltraSrtNcstAtHour() {
    return null;
  },
  async getUltraSrtFcst() {
    return { items: [{ category: 'SKY', fcstDate: '20261017', fcstTime: '1030', fcstValue: '1' }], baseAt: '2026-10-17T10:00:00+09:00' };
  },
  async getVilageFcst() {
    return null;
  },
};

/** 기상청 차단 — 조회가 전부 null(키 오류·통신 실패와 같은 모양). */
const deadKma: KmaClient = {
  async getUltraSrtNcst() {
    return null;
  },
  async getUltraSrtNcstAtHour() {
    return null;
  },
  async getUltraSrtFcst() {
    return null;
  },
  async getVilageFcst() {
    return null;
  },
};

function computeStub(up: boolean): ComputeClient {
  return {
    async ping() {
      return up;
    },
    async requestCurrent() {
      throw new Error('이 테스트는 메인 화면 영역만 본다');
    },
    async requestForecast() {
      throw new Error('이 테스트는 메인 화면 영역만 본다');
    },
  };
}

function buildApp(deps: { sensorClient: SensorClient; kmaClient: KmaClient; computeClient: ComputeClient }): FastifyInstance {
  const app = Fastify();
  registerHealthRoute(app, deps);
  registerMainRoomsRoute(app, { sensorClient: deps.sensorClient });
  registerMainWeatherKmaRoute(app, { kmaClient: deps.kmaClient, farmLat: FARM_LAT, farmLon: FARM_LON, areaName: '' });
  registerMainWeatherStationRoute(app, { sensorClient: deps.sensorClient, farmLat: FARM_LAT, farmLon: FARM_LON });
  return app;
}

async function getJson<T>(app: FastifyInstance, url: string): Promise<T> {
  const res = await app.inject({ method: 'GET', url });
  return res.json() as T;
}

describe('영역별 끊김 격리 (M7-5)', () => {
  it('센서 서버만 끊기면 방 3개와 미세기후만 끊김, 기상청 영역은 정상', async () => {
    const app = buildApp({ sensorClient: deadSensor, kmaClient: liveKma, computeClient: computeStub(true) });

    const rooms = await getJson<ApiOk<RoomsResponse>>(app, '/api/main/rooms');
    const station = await getJson<ApiOk<StationWeather>>(app, '/api/main/weather/station');
    const kma = await getJson<ApiOk<KmaWeather>>(app, '/api/main/weather/kma');

    // 센서를 쓰는 두 영역만 끊긴다. 응답 자체는 200으로 내려와야 한다(전체 실패 금지).
    for (const id of ['NH', 'GH', 'FH'] as const) {
      expect(rooms.data[id].sourceStatus).toBe('disconnected');
      expect(rooms.data[id].temp).toBeNull();
    }
    expect(station.data.sourceStatus).toBe('disconnected');

    // 기상청 영역은 멀쩡해야 한다 — 여기가 이 테스트의 핵심이다.
    expect(kma.data.sourceStatus).toBe('ok');
    expect(kma.data.temp).toBe(23.3);
    expect(kma.data.windSpeed).toBe(3.7);

    const health = await getJson<Health>(app, '/api/health');
    expect(health).toEqual({ relay: 'ok', sensor: 'disconnected', kma: 'ok', compute: 'ok' });

    await app.close();
  });

  it('기상청만 끊기면 기상청 영역만 끊김, 방 3개와 미세기후는 정상', async () => {
    const app = buildApp({ sensorClient: liveSensor, kmaClient: deadKma, computeClient: computeStub(true) });

    const rooms = await getJson<ApiOk<RoomsResponse>>(app, '/api/main/rooms');
    const station = await getJson<ApiOk<StationWeather>>(app, '/api/main/weather/station');
    const kma = await getJson<ApiOk<KmaWeather>>(app, '/api/main/weather/kma');

    expect(kma.data.sourceStatus).toBe('disconnected');
    expect(kma.data.temp).toBeNull();

    // 센서를 쓰는 영역은 그대로 값이 보여야 한다.
    for (const id of ['NH', 'GH', 'FH'] as const) {
      expect(rooms.data[id].sourceStatus).toBe('ok');
      expect(rooms.data[id].temp).toBe(27.6);
    }
    expect(station.data.sourceStatus).toBe('ok');
    expect(station.data.temp).toBe(22.3);
    // 기상대 풍속(CURWIND)은 m/s라 환산 없이 그대로다(2026-10-19 재확인, 05 #43).
    expect(station.data.windSpeed).toBe(14);

    const health = await getJson<Health>(app, '/api/health');
    expect(health).toEqual({ relay: 'ok', sensor: 'ok', kma: 'disconnected', compute: 'ok' });

    await app.close();
  });

  it('연산 서버만 끊기면 메인 화면 세 영역은 모두 정상(상세 패널만 영향)', async () => {
    const app = buildApp({ sensorClient: liveSensor, kmaClient: liveKma, computeClient: computeStub(false) });

    const rooms = await getJson<ApiOk<RoomsResponse>>(app, '/api/main/rooms');
    const station = await getJson<ApiOk<StationWeather>>(app, '/api/main/weather/station');
    const kma = await getJson<ApiOk<KmaWeather>>(app, '/api/main/weather/kma');

    expect(rooms.data.NH.sourceStatus).toBe('ok');
    expect(station.data.sourceStatus).toBe('ok');
    expect(kma.data.sourceStatus).toBe('ok');

    // 연산 서버 상태는 /api/health에만 드러난다 — 메인 화면은 연산 서버를 쓰지 않는다.
    const health = await getJson<Health>(app, '/api/health');
    expect(health).toEqual({ relay: 'ok', sensor: 'ok', kma: 'ok', compute: 'disconnected' });

    await app.close();
  });

  it('센서와 기상청이 동시에 끊겨도 서버는 200으로 응답한다(전체 실패로 만들지 않는다)', async () => {
    const app = buildApp({ sensorClient: deadSensor, kmaClient: deadKma, computeClient: computeStub(false) });

    for (const url of ['/api/main/rooms', '/api/main/weather/station', '/api/main/weather/kma']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, `${url}는 끊겨도 200이어야 한다`).toBe(200);
      expect((res.json() as ApiOk<unknown>).status).not.toBe('error');
    }

    const health = await getJson<Health>(app, '/api/health');
    expect(health).toEqual({ relay: 'ok', sensor: 'disconnected', kma: 'disconnected', compute: 'disconnected' });

    await app.close();
  });
});
