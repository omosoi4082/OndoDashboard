// COMPUTE_MODE(mock|http)에 따라 ComputeClient 구현을 고른다. sensorClient.ts/kmaClient.ts의
// createXxxClient 패턴과 같되, mock 구현(MockComputeClient)이 http 구현과 별도 파일에 있어
// 순환 참조를 피하려고 조립만 하는 파일을 둔다.
import type { Geometry } from '@ondo/shared';
import type { ComputeClient } from './computeClient.js';
import { createHttpComputeClient } from './computeClient.js';
import { createMockComputeClient } from './mockComputeClient.js';
import { withComputeRetry } from './computeRetry.js';
import { withComputeQueue } from './computeQueue.js';

export interface ComputeClientOpts {
  mode: 'mock' | 'http';
  geometry: Geometry; // mock 모드
  baseUrl: string; // http 모드
  apiKey: string;
  apiKeyHeader: string;
  timeoutMs: number;
  /** GET /v1/health 타임아웃(http 모드). */
  pingTimeoutMs: number;
  /** SERVER 오류 재시도 대기(http 모드, D-4). */
  retryDelayMs: number;
  /** BUSY 오류 재시도 대기 순서(http 모드, 2026-10-30 온도 측 요청). */
  busyRetryDelaysMs: readonly number[];
  /** 요청에 `viz: true`(v1.3.3)를 넣을지(http 모드). */
  viz: boolean;
}

export function createComputeClient(opts: ComputeClientOpts): ComputeClient {
  if (opts.mode === 'mock') {
    return createMockComputeClient({ geometry: opts.geometry });
  }
  // 재시도는 http 모드에만 씌운다 — mock은 오류 code를 내지 않는다(D-4, clients/computeRetry.ts).
  const http = createHttpComputeClient({
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    apiKeyHeader: opts.apiKeyHeader,
    timeoutMs: opts.timeoutMs,
    pingTimeoutMs: opts.pingTimeoutMs,
    viz: opts.viz,
  });
  // 줄 세우기(한 번에 1건)를 먼저 씌우고 재시도를 그 바깥에 둔다 — BUSY 대기 중에 줄을
  // 잡고 있으면 다른 화면이 그만큼 더 기다린다(clients/computeQueue.ts).
  return withComputeRetry(withComputeQueue(http), {
    delayMs: opts.retryDelayMs,
    busyDelaysMs: opts.busyRetryDelaysMs,
  });
}
