// 연산 서버 실패 시 마지막 정상 결과 유지(2026-10-14 D-4, 온도 측 확인: "타임아웃이면
// '예측 서버 연결 안 됨'을 띄우고 마지막 정상 결과는 화면에 남겨 달라").
//
// 현재 모드는 10분마다 다시 조회한다(useCurrentDetailPolling). 재조회가 연산 서버 실패
// (ApiError, source 'compute' — UPSTREAM_TIMEOUT/UPSTREAM_UNREACHABLE/UPSTREAM_ERROR)로
// 끝났는데 이미 정상 결과(ok/partial)를 갖고 있으면 그 결과를 그대로 두고 오류 문구만
// 알림으로 띄운다. 이전 정상 결과가 없거나 실패 원인이 연산 서버가 아니면(센서 결측,
// 중계 서버 접속 실패 등) 지금까지처럼 새 응답(오류)으로 바꾼다.
import type { ApiResponse } from '@ondo/shared';

export interface KeptResult<T> {
  /** 화면에 그릴 응답. */
  response: ApiResponse<T>;
  /** 이전 결과를 유지하는 중이면 띄울 오류 문구, 아니면 null. */
  staleNotice: string | null;
}

export function keepLastGoodOnComputeFailure<T>(
  prev: ApiResponse<T> | null,
  next: ApiResponse<T>,
  /**
   * 유지하는 결과의 시각을 뽑는다 — 온도 측 2026-10-14 회신: "마지막 정상 결과를 **그 시각과
   * 함께** 유지해 주시면 됩니다". 화면 문구가 "지금 값"으로 오해되지 않게 언제 값인지 같이 쓴다.
   */
  keptTimeOf?: (data: T) => string | null,
): KeptResult<T> {
  if (next.status === 'error' && next.error.source === 'compute' && prev !== null && prev.status !== 'error') {
    const keptTime = keptTimeOf?.(prev.data) ?? null;
    return {
      response: prev,
      staleNotice: keptTime ? `${next.error.message} (마지막 결과 ${keptTime})` : next.error.message,
    };
  }
  return { response: next, staleNotice: null };
}
