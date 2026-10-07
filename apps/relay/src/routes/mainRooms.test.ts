import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerMainRoomsRoute } from './mainRooms.js';
import type { SensorClient } from '../clients/sensorClient.js';
import type { SensorDevice } from '../clients/sensorParse.js';
import type { ApiOk, RoomsResponse } from '@ondo/shared';

function fakeDevice(temp: number): SensorDevice {
  return { TEMP: { timestamp: '2026-10-05T15:28:10', value: temp } };
}

describe('GET /api/main/rooms', () => {
  it('한 방의 EN1만 실패해도 나머지 방은 정상(partial)', async () => {
    const sensorClient: SensorClient = {
      async latest(devicePath: string) {
        if (devicePath === 'JE/EX/GH/EN1') return null; // GH 환경센서만 막힘
        if (devicePath.endsWith('/EN1')) return fakeDevice(25);
        return { FAN1: { timestamp: '2026-10-05T15:28:10', value: 50 } };
      },
    };

    const app = Fastify();
    registerMainRoomsRoute(app, { sensorClient });

    const res = await app.inject({ method: 'GET', url: '/api/main/rooms' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as ApiOk<RoomsResponse>;

    expect(body.status).toBe('partial');
    expect(body.data.NH.sourceStatus).toBe('ok');
    expect(body.data.FH.sourceStatus).toBe('ok');
    expect(body.data.GH.sourceStatus).toBe('disconnected');
    expect(body.data.GH.fanRate).toBe(50); // FN1은 살아있으니 값은 채워짐
    expect(body.data.GH.temp).toBeNull();

    await app.close();
  });

  it('모든 센서가 정상이면 status=ok', async () => {
    const sensorClient: SensorClient = {
      async latest(devicePath: string) {
        if (devicePath.endsWith('/EN1')) return fakeDevice(25);
        return { FAN1: { timestamp: '2026-10-05T15:28:10', value: 50 } };
      },
    };

    const app = Fastify();
    registerMainRoomsRoute(app, { sensorClient });

    const res = await app.inject({ method: 'GET', url: '/api/main/rooms' });
    const body = res.json() as ApiOk<RoomsResponse>;
    expect(body.status).toBe('ok');
    expect(body.data.NH.sourceStatus).toBe('ok');
    expect(body.data.GH.sourceStatus).toBe('ok');
    expect(body.data.FH.sourceStatus).toBe('ok');

    await app.close();
  });
});
