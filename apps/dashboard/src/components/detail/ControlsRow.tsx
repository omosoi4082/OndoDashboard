// 상세 패널 모드별 컨트롤 중 공통부(01-functional-spec.md 3장): 10·15·22·29 유동/습도/온도 토글
// (기본 온도). 디자인(docs/06-design-guide.md)대로 "분석 항목" 줄에 3D 온도/3D 유동/3D 습도
// 순서의 아이콘 버튼으로 두고 아래에 구분선을 긋는다. 포인트 on/off(11·16·23·30)는 "3D 자돈방"
// 제목 줄로 옮겼다(DetailSections.tsx의 PointsToggle).
// 토글 전환은 받은 데이터로만 다시 그린다(재요청 없음) — 그냥 zustand 값만 바꾼다.
import type { ReactElement } from 'react';
import { Droplet, Thermometer, Wind, type LucideIcon } from 'lucide-react';
import { useDetailStore, type ValueField } from '../../store/detailStore.js';

const VALUE_FIELDS: ReadonlyArray<{ id: ValueField; label: string; Icon: LucideIcon }> = [
  { id: 'temp', label: '3D 온도', Icon: Thermometer },
  { id: 'flow', label: '3D 유동', Icon: Wind },
  { id: 'rh', label: '3D 습도', Icon: Droplet },
];

export function ControlsRow(): ReactElement {
  const valueField = useDetailStore((s) => s.valueField);
  const setValueField = useDetailStore((s) => s.setValueField);

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-ondo-border pb-5">
      <span className="text-sm font-medium text-white">분석 항목</span>
      <div className="flex gap-2">
        {VALUE_FIELDS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setValueField(id)}
            className={`flex h-[42px] w-[110px] items-center justify-center gap-1.5 rounded-md border text-[15px] transition-colors ${
              valueField === id
                ? 'border-white/50 bg-[#3b3c42] text-white'
                : 'border-ondo-border bg-ondo-surface-2 text-ondo-muted hover:text-white'
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
