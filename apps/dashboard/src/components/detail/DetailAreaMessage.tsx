// 상세 패널(6) 3D/2D 영역의 로딩·오류 placeholder — DetailPanel.tsx(현재 모드)와
// ForecastDetailView.tsx(예측 모드)가 공유한다(M3부터 쓰던 것을 M5에서 공용 컴포넌트로 분리).
import type { ReactElement } from 'react';

/**
 * 로딩 중임을 알리는 작은 회전 표시(2026-10-30 사용자 지적 — "글만 보이면 화면이 멈춘 것
 * 같잖아"). 예측 1건이 연산 서버에서 12~25초 걸리고, 다른 요청 뒤에 줄을 서면 더 걸릴 수
 * 있어서(clients/computeQueue.ts) 글자만 두면 멎은 화면과 구분이 안 된다.
 * 오류 문구에는 붙이지 않는다 — 기다리면 끝나는 상태가 아니다.
 */
export function LoadingSpinner(): ReactElement {
  return (
    <span
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
    />
  );
}

export function DetailAreaMessage({ text, isError }: { text: string; isError: boolean }): ReactElement {
  return (
    <div
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 text-center text-sm ${
        isError ? 'border-red-500/30 bg-red-500/5 text-red-300' : 'border-white/10 text-white/40'
      }`}
    >
      {!isError && <LoadingSpinner />}
      {isError ? text : <span className="ondo-loading-text">{text}</span>}
    </div>
  );
}
