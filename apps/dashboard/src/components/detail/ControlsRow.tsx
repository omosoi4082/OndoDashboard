// 상세 패널 모드별 컨트롤 줄 중 공통부(01-functional-spec.md 3장):
// 10·15·22·29 유동/습도/온도 토글(기본 온도) + 11·16·23·30 포인트 on/off(기본 on).
// 토글 전환은 받은 데이터로만 다시 그린다(재요청 없음) — 그냥 zustand 값만 바꾼다.
import type { ReactElement } from 'react';
import { useDetailStore, type ValueField } from '../../store/detailStore.js';

const VALUE_FIELDS: ReadonlyArray<{ id: ValueField; label: string }> = [
  { id: 'flow', label: '유동' },
  { id: 'rh', label: '습도' },
  { id: 'temp', label: '온도' },
];

export function ControlsRow(): ReactElement {
  const valueField = useDetailStore((s) => s.valueField);
  const setValueField = useDetailStore((s) => s.setValueField);
  const pointsVisible = useDetailStore((s) => s.pointsVisible);
  const setPointsVisible = useDetailStore((s) => s.setPointsVisible);

  return (
    <div className="flex items-center justify-between">
      <div className="flex gap-1">
        {VALUE_FIELDS.map((field) => (
          <button
            key={field.id}
            type="button"
            onClick={() => setValueField(field.id)}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              valueField === field.id ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-white/50 hover:text-white/70'
            }`}
          >
            {field.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-xs text-white/60">
        <input
          type="checkbox"
          checked={pointsVisible}
          onChange={(e) => setPointsVisible(e.target.checked)}
          className="accent-cyan-400"
        />
        포인트 표시
      </label>
    </div>
  );
}
