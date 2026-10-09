// COMPUTE_MODE(mock|http)에 따라 ComputeClient 구현을 고른다. sensorClient.ts/kmaClient.ts의
// createXxxClient 패턴과 같되, mock 구현(MockComputeClient)이 http 구현과 별도 파일에 있어
// 순환 참조를 피하려고 조립만 하는 파일을 둔다.
import type { Geometry } from '@ondo/shared';
import type { ComputeClient } from './computeClient.js';
import { createHttpComputeClient } from './computeClient.js';
import { createMockComputeClient } from './mockComputeClient.js';

export interface ComputeClientOpts {
  mode: 'mock' | 'http';
  geometry: Geometry; // mock 모드
  baseUrl: string; // http 모드
  apiKey: string;
  apiKeyHeader: string;
  timeoutMs: number;
}

export function createComputeClient(opts: ComputeClientOpts): ComputeClient {
  if (opts.mode === 'mock') {
    return createMockComputeClient({ geometry: opts.geometry });
  }
  return createHttpComputeClient({
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    apiKeyHeader: opts.apiKeyHeader,
    timeoutMs: opts.timeoutMs,
  });
}
