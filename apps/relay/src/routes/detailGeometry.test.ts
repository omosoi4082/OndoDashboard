import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerDetailGeometryRoute } from './detailGeometry.js';
import type { Geometry } from '@ondo/shared';

function fakeGeometry(): Geometry {
  return {
    geometryId: 'pig-nh-v1',
    room: { size: [4.5, 4.0, 2.8], inlets: [{ x: 2.25, y: 0.83, z: 2.8, w: 0.32, l: 0.687 }], outlet: { wall: 'y=0', x: 2.25, z: 1.6, d: 0.4 } },
    points: [{ id: 0, x: 0, y: 0, z: 0 }],
    grid: { origin: [0, 0, 0], spacing: [0.25, 0.25, 0.4], size: [19, 17, 8] },
    flowGrid: { origin: [0.25, 0.25, 0.35], spacing: [0.5, 0.5, 0.7], size: [9, 8, 4] },
  };
}

describe('GET /api/detail/geometry', () => {
  it('로드해둔 geometry를 그대로(ApiOk로 감싸지 않고) 반환한다', async () => {
    const geometry = fakeGeometry();
    const app = Fastify();
    registerDetailGeometryRoute(app, { geometry });

    const res = await app.inject({ method: 'GET', url: '/api/detail/geometry' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(geometry);

    await app.close();
  });
});
