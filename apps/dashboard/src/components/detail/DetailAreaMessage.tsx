// 상세 패널(6) 3D/2D 영역의 로딩·오류 placeholder — DetailPanel.tsx(현재 모드)와
// ForecastDetailView.tsx(예측 모드)가 공유한다(M3부터 쓰던 것을 M5에서 공용 컴포넌트로 분리).
import type { ReactElement } from 'react';

export function DetailAreaMessage({ text, isError }: { text: string; isError: boolean }): ReactElement {
  return (
    <div
      className={`flex flex-1 items-center justify-center rounded-lg border px-4 text-center text-sm ${
        isError ? 'border-red-500/30 bg-red-500/5 text-red-300' : 'border-white/10 text-white/40'
      }`}
    >
      {text}
    </div>
  );
}
