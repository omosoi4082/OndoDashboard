// 타임아웃이 있는 GET 요청. 센서 서버·기상청 클라이언트가 공용으로 쓴다.

export interface FetchTextResult {
  ok: boolean;
  status: number;
  text: string;
}

export async function fetchText(url: string, timeoutMs: number): Promise<FetchTextResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}
