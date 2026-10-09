// docs/02-relay-api.md 5장 "GET /api/detail/geometry" — 상세 진입 시 1회, GEOMETRY_FILE을
// 그대로 반환한다(ApiOk로 감싸지 않음, 연산 서버 호출 없음). 파일 로드·검증은
// config/geometry.ts에서 서버 시작 시 1회 끝낸다.
import type { FastifyInstance } from 'fastify';
import type { Geometry } from '@ondo/shared';

export function registerDetailGeometryRoute(app: FastifyInstance, deps: { geometry: Geometry }): void {
  app.get('/api/detail/geometry', async (): Promise<Geometry> => deps.geometry);
}
