// 상세보기 패널(6) 상단 모드 탭(7) — 현재/예측/전문가/제어(01-functional-spec.md 1장).
// 스타일은 docs/06-design-guide.md "상세 패널": 둥근 컨테이너 안 4칸, 선택 탭은 초록 채움.
import type { ReactElement } from 'react';
import { useDetailStore, type DetailMode } from '../../store/detailStore.js';

const TABS: ReadonlyArray<{ id: DetailMode; label: string }> = [
  { id: 'current', label: '현재 모드' },
  { id: 'forecast', label: '예측 모드' },
  { id: 'expert', label: '전문가 모드' },
  { id: 'control', label: '제어 모드' },
];

export function ModeTabs(): ReactElement {
  const mode = useDetailStore((s) => s.mode);
  const setMode = useDetailStore((s) => s.setMode);

  return (
    <div className="grid shrink-0 grid-cols-4 gap-1 rounded-[32px] bg-ondo-surface p-1.5">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setMode(tab.id)}
          className={`h-[52px] rounded-[24px] text-base transition-colors ${
            mode === tab.id ? 'bg-ondo-accent font-semibold text-white' : 'text-ondo-muted hover:text-white'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
