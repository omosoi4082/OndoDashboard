// POST /api/detail/expert(B-2). 목업 파일은 실제 mock/mock_expert.json을 읽는다(.env 기본 경로가
// 저장소 루트 기준이라 그 파일이 필요 — mockExpertControl 로더와 같은 조건).
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerDetailExpertRoute } from './detailExpert.js';
import { geometry } from '../config/geometry.js';

const RANGE = { tempMin: -30, tempMax: 50, rhMin: 0, rhMax: 100, ventMin: 20, ventMax: 100 };
const ROWS = Array.from({ length: 24 }, () => ({ temp: 30, rh: 60, vent: 80 }));

async function makeApp(): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify();
  registerDetailExpertRoute(app, { geometry, inputRange: RANGE });
  await app.ready();
  return app;
}

describe('POST /api/detail/expert', () => {
  it('24행이 유효하면 145프레임과 input.rows echo를 돌려준다', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/api/detail/expert', payload: { rows: ROWS } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.data.mode).toBe('expert');
    expect(body.data.input).toEqual({ rows: ROWS });
    expect(body.data.frames.length).toBe(145);
    await app.close();
  });

  it('행 수가 틀리면 400 BAD_REQUEST', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/api/detail/expert', payload: { rows: ROWS.slice(1) } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('BAD_REQUEST');
    await app.close();
  });

  it('GET은 더 이상 받지 않는다(404)', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/detail/expert?temp=25&rh=60&vent=50' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
