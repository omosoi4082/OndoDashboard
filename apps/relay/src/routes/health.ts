import type { FastifyInstance } from 'fastify';
import type { Health } from '@ondo/shared';
import type { SensorClient } from '../clients/sensorClient.js';
import type { KmaClient } from '../clients/kmaClient.js';

// 연산 서버 클라이언트는 M4/M8에서 붙는다. 그 전까지 compute는 'disconnected'.
export function registerHealthRoute(
  app: FastifyInstance,
  deps: { sensorClient: SensorClient; kmaClient: KmaClient },
): void {
  app.get('/api/health', async (): Promise<Health> => {
    const [sensorResult, kmaResult] = await Promise.allSettled([
      deps.sensorClient.latest('JE/OU/WS/WS1'),
      deps.kmaClient.getUltraSrtNcst(new Date()),
    ]);

    const sensor = sensorResult.status === 'fulfilled' && sensorResult.value !== null ? 'ok' : 'disconnected';
    const kma = kmaResult.status === 'fulfilled' && kmaResult.value !== null ? 'ok' : 'disconnected';

    return {
      relay: 'ok',
      sensor,
      kma,
      compute: 'disconnected',
    };
  });
}
