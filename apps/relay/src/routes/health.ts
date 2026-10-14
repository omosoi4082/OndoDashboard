import type { FastifyInstance } from 'fastify';
import type { Health } from '@ondo/shared';
import type { SensorClient } from '../clients/sensorClient.js';
import type { KmaClient } from '../clients/kmaClient.js';
import type { ComputeClient } from '../clients/computeClient.js';

// 진단용(docs/02-relay-api.md 7장). 상위 서버 셋을 동시에 확인하고, 하나가 실패해도 나머지는
// 그대로 보고한다. 연산 서버는 GET /v1/health(2026-10-13 D-5) — mock 모드는 항상 ok.
export function registerHealthRoute(
  app: FastifyInstance,
  deps: { sensorClient: SensorClient; kmaClient: KmaClient; computeClient: ComputeClient },
): void {
  app.get('/api/health', async (): Promise<Health> => {
    const [sensorResult, kmaResult, computeResult] = await Promise.allSettled([
      deps.sensorClient.latest('JE/OU/WS/WS1'),
      deps.kmaClient.getUltraSrtNcst(new Date()),
      deps.computeClient.ping(),
    ]);

    const sensor = sensorResult.status === 'fulfilled' && sensorResult.value !== null ? 'ok' : 'disconnected';
    const kma = kmaResult.status === 'fulfilled' && kmaResult.value !== null ? 'ok' : 'disconnected';
    const compute = computeResult.status === 'fulfilled' && computeResult.value ? 'ok' : 'disconnected';

    return {
      relay: 'ok',
      sensor,
      kma,
      compute,
    };
  });
}
