import type { FastifyInstance } from 'fastify';
import type { Health } from '@ondo/shared';

// 센서·기상청·연산 서버 클라이언트는 M1/M4에서 붙는다. 그 전까지 relay 외 항목은 'disconnected'.
export function registerHealthRoute(app: FastifyInstance): void {
  app.get('/api/health', async (): Promise<Health> => {
    return {
      relay: 'ok',
      sensor: 'disconnected',
      kma: 'disconnected',
      compute: 'disconnected',
    };
  });
}
