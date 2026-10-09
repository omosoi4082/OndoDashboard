// docs/02-relay-api.md 2장 ApiErrorCode ↔ HTTP 상태 매핑. ApiError를 돌려주는 모든 라우트가
// 공유한다(M4부터 — 이전 라우트는 partial만 쓰고 ApiError를 만들지 않았다).
import type { ApiErrorCode } from '@ondo/shared';

export function httpStatusForErrorCode(code: ApiErrorCode): number {
  switch (code) {
    case 'BAD_REQUEST':
      return 400;
    case 'UPSTREAM_TIMEOUT':
      return 504;
    case 'UPSTREAM_ERROR':
      return 502;
    case 'UPSTREAM_UNREACHABLE':
      return 502;
    case 'INTERNAL_ERROR':
      return 500;
    default:
      return 500;
  }
}
