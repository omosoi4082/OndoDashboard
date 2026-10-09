// 3D 모델·첫 데이터 로딩 동안 표시하는 로딩바 (01-functional-spec.md 2장, 6장 "초기 로딩").
import type { ReactElement } from 'react';

export function LoadingOverlay(): ReactElement {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#0e1116]/90">
      <div className="h-1.5 w-64 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-cyan-400" />
      </div>
      <p className="text-sm text-white/60">불러오는 중…</p>
    </div>
  );
}
