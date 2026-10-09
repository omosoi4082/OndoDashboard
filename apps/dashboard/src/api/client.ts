// 대시보드는 /api/*(중계 서버)만 호출한다(CLAUDE.md 규칙). 센서·기상청·연산 서버를
// 브라우저에서 직접 호출하지 않는다.
import type { ApiResponse } from '@ondo/shared';

/**
 * fetch 자체가 실패(네트워크 오류, 중계 서버 다운)하면 ApiError 형태로 감싸 반환한다 —
 * "중계 서버 자체에 접속 실패면 모든 영역 끊김 표시"(docs/02-relay-api.md 2장)와 같은
 * 모양으로 호출 측(zustand store/컴포넌트)이 ApiResponse만 다루면 되게 한다.
 */
/** status가 'ok'|'partial'일 때만 data를 꺼내고, 'error'·null이면 null(화면은 끊김 표시). */
export function okData<T>(res: ApiResponse<T> | null): T | null {
  if (res === null || res.status === 'error') return null;
  return res.data;
}

/**
 * ApiResponse 포장 없이 그대로 오는 응답에 쓴다(GET /api/detail/geometry —
 * docs/02-relay-api.md "GEOMETRY_FILE을 그대로 반환"). 실패하면 그대로 reject하므로
 * 호출 측(훅)이 try/catch로 처리한다.
 */
export async function fetchRaw<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} 요청 실패: ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchApi<T>(path: string): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(path);
    const json = (await res.json()) as ApiResponse<T>;
    return json;
  } catch (err) {
    return {
      status: 'error',
      requestedAt: new Date().toISOString(),
      error: {
        code: 'UPSTREAM_UNREACHABLE',
        source: 'relay',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
