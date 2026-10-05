import { useEffect, useState } from 'react';
import type { ApiResponse, Health } from '@ondo/shared';

// M0 완료 조건 확인용 임시 화면. 실제 레이아웃(Header/OutdoorPanel/MainScene/...)은 M2에서 만든다.
function App() {
  const [health, setHealth] = useState<ApiResponse<Health> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<ApiResponse<Health>>)
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center font-sans">
      <div className="rounded-xl border border-white/10 bg-white/5 px-8 py-6 backdrop-blur">
        <h1 className="mb-4 text-xl text-cyan-300">온도 대시보드 — M0 상태 확인</h1>
        {error && <p className="text-red-400">끊김: {error}</p>}
        {!error && !health && <p className="text-white/60">GET /api/health 응답 대기 중…</p>}
        {health && <pre className="text-sm text-white/80">{JSON.stringify(health, null, 2)}</pre>}
      </div>
    </main>
  );
}

export default App;
