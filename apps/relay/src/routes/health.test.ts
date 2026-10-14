// GET /api/health: 센서·기상청·연산 서버(GET /v1/health, D-5)를 동시에 확인한다.
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { Health } from '@ondo/shared';
import { registerHealthRoute } from './health.js';
import type { SensorClient } from '../clients/sensorClient.js';
import type { KmaClient } from '../clients/kmaClient.js';
import type { ComputeClient } from '../clients/computeClient.js';

const sensorClient: SensorClient = {
  async latest() {
    return { TEMP: { timestamp: '2026-10-05T15:28:10', value: 20 } };
  },
};

const kmaClient: KmaClient = {
  async getUltraSrtNcst() {
    return { map: { T1H: '21.5' }, baseAt: '2026-10-07T15:00:00+09:00' };
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

function computeClient(ping: () => Promise<boolean>): ComputeClient {
  return {
    ping,
    async requestCurrent() {
      return { ok: false, code: 'UPSTREAM_ERROR', message: 'unused' };
    },
    async requestForecast() {
      return { ok: false, code: 'UPSTREAM_ERROR', message: 'unused' };
    },
  };
}

async function getHealth(compute: ComputeClient): Promise<Health> {
  const app = Fastify();
  registerHealthRoute(app, { sensorClient, kmaClient, computeClient: compute });
  const res = await app.inject({ method: 'GET', url: '/api/health' });
  await app.close();
  expect(res.statusCode).toBe(200);
  return res.json() as Health;
}

describe('GET /api/health', () => {
  it('연산 서버 ping 성공 → compute ok', async () => {
    const body = await getHealth(computeClient(async () => true));
    expect(body).toEqual({ relay: 'ok', sensor: 'ok', kma: 'ok', compute: 'ok' });
  });

  it('ping false → compute만 disconnected', async () => {
    const body = await getHealth(computeClient(async () => false));
    expect(body.compute).toBe('disconnected');
    expect(body.sensor).toBe('ok');
  });

  it('ping이 예외를 던져도 나머지는 그대로', async () => {
    const body = await getHealth(computeClient(() => Promise.reject(new Error('boom'))));
    expect(body.compute).toBe('disconnected');
    expect(body.kma).toBe('ok');
  });
});
