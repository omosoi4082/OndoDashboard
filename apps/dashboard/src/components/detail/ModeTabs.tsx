// 상세보기 패널(6) 상단 모드 탭(7) — 현재/예측/전문가/제어(01-functional-spec.md 1장).
// 지금은 "현재"만 실제 내용이 있다(M3 범위) — 나머지 탭도 선택은 가능하고 빈 상태만
// 보여준다(docs/04-tasks.md M3: "나머지 탭은 선택만 가능한 빈 상태로 둬도 됨").
import type { ReactElement } from 'react';
import { useDetailStore, type DetailMode } from '../../store/detailStore.js';

const TABS: ReadonlyArray<{ id: DetailMode; label: string }> = [
  { id: 'current', label: '현재' },
  { id: 'forecast', label: '예측' },
  { id: 'expert', label: '전문가' },
  { id: 'control', label: '제어' },
];

export function ModeTabs(): ReactElement {
  const mode = useDetailStore((s) => s.mode);
  const setMode = useDetailStore((s) => s.setMode);

  return (
    <div className="flex gap-2">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setMode(tab.id)}
          className={`rounded px-3 py-1.5 text-xs transition-colors ${
            mode === tab.id ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-white/40 hover:text-white/60'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
