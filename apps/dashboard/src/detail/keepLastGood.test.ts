import { describe, expect, it } from 'vitest';
import type { ApiError, ApiResponse, ApiErrorCode, UpstreamSource } from '@ondo/shared';
import { keepLastGoodOnComputeFailure } from './keepLastGood.js';

const ok = (n: number): ApiResponse<number> => ({ status: 'ok', requestedAt: `t${n}`, data: n });
const partial = (n: number): ApiResponse<number> => ({ status: 'partial', requestedAt: `t${n}`, data: n });
const err = (source: UpstreamSource, code: ApiErrorCode = 'UPSTREAM_TIMEOUT', message = '예측 서버 연결 안 됨'): ApiError => ({
  status: 'error',
  requestedAt: 'te',
  error: { code, source, message },
});

describe('keepLastGoodOnComputeFailure', () => {
  it('정상 응답은 그대로 쓰고 알림이 없다', () => {
    expect(keepLastGoodOnComputeFailure(ok(1), ok(2))).toEqual({ response: ok(2), staleNotice: null });
    expect(keepLastGoodOnComputeFailure(null, partial(3))).toEqual({ response: partial(3), staleNotice: null });
  });

  it.each<ApiErrorCode>(['UPSTREAM_TIMEOUT', 'UPSTREAM_UNREACHABLE', 'UPSTREAM_ERROR'])(
    '연산 서버 실패(%s) + 이전 정상 결과 → 이전 결과 유지, 오류 문구를 알림으로',
    (code) => {
      const result = keepLastGoodOnComputeFailure(ok(1), err('compute', code, '예측 서버 오류'));
      expect(result.response).toEqual(ok(1));
      expect(result.staleNotice).toBe('예측 서버 오류');
    },
  );

  it('이전 결과가 partial이어도 정상 결과로 보고 유지한다', () => {
    expect(keepLastGoodOnComputeFailure(partial(1), err('compute')).response).toEqual(partial(1));
  });

  it('이전 정상 결과가 없으면(최초·이전도 오류) 오류로 바꾼다', () => {
    expect(keepLastGoodOnComputeFailure(null, err('compute'))).toEqual({ response: err('compute'), staleNotice: null });
    const prevErr = err('compute', 'UPSTREAM_ERROR', '이전 오류');
    expect(keepLastGoodOnComputeFailure(prevErr, err('compute'))).toEqual({ response: err('compute'), staleNotice: null });
  });

  it('연산 서버가 아닌 실패(센서·중계 서버)는 지금처럼 오류로 바꾼다', () => {
    for (const source of ['sensor', 'relay', 'kma'] as const) {
      expect(keepLastGoodOnComputeFailure(ok(1), err(source))).toEqual({ response: err(source), staleNotice: null });
    }
  });

  it('마지막 결과 시각을 주면 문구 뒤에 붙인다(온도 측 2026-10-14 회신)', () => {
    const prev = { status: 'ok', requestedAt: '2026-10-14T15:30:00+09:00', data: { baseAt: '2026-10-14T15:20:00+09:00' } } as const;
    const next = {
      status: 'error',
      requestedAt: '2026-10-14T15:40:00+09:00',
      error: { code: 'UPSTREAM_TIMEOUT', source: 'compute', message: '예측 서버 연결 안 됨' },
    } as const;
    const kept = keepLastGoodOnComputeFailure(prev, next, (d) => d.baseAt.slice(11, 16));
    expect(kept.response).toBe(prev);
    expect(kept.staleNotice).toBe('예측 서버 연결 안 됨 (마지막 결과 15:20)');
  });
});
