// 전문가 모드 입력 필드(21) — 01-functional-spec.md 4.3: 온도·습도·환기량 3개 + 확인
// 버튼. 유효성 검사(detail/expertInputValidation.ts)를 통과 못 하면 확인 버튼 비활성화 +
// 필드 옆 안내 문구를 보여준다. 입력값 자체는 ExpertModeView.tsx가 들고 있다(모드 탭을
// 벗어나면 같이 사라지는 폼 상태라 전역 store에 둘 필요가 없다고 판단).
import type { ReactElement } from 'react';
import type { ExpertInputDraft, ExpertInputValidation } from '../../detail/expertInputValidation.js';

interface ExpertInputFormProps {
  draft: ExpertInputDraft;
  validation: ExpertInputValidation;
  isLoading: boolean;
  onChange: (next: ExpertInputDraft) => void;
  onSubmit: () => void;
}

const FIELDS: ReadonlyArray<{ key: keyof ExpertInputDraft; label: string; unit: string }> = [
  { key: 'temp', label: '온도', unit: '℃' },
  { key: 'rh', label: '습도', unit: '%' },
  { key: 'vent', label: '환기량', unit: '%' },
];

export function ExpertInputForm({ draft, validation, isLoading, onChange, onSubmit }: ExpertInputFormProps): ReactElement {
  return (
    <div className="flex shrink-0 items-start gap-2 rounded-lg border border-white/10 bg-[#0b0d12] p-2">
      {FIELDS.map((field) => {
        const fieldValidation = validation[field.key];
        return (
          <label key={field.key} className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-white/60">
            <span>
              {field.label} ({field.unit})
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={draft[field.key]}
              onChange={(e) => onChange({ ...draft, [field.key]: e.target.value })}
              className={`w-full min-w-0 rounded border bg-black/30 px-2 py-1 text-sm text-white outline-none focus:border-cyan-400/50 ${
                fieldValidation.error ? 'border-red-500/50' : 'border-white/10'
              }`}
            />
            <span className="h-3 text-[10px] text-red-300">{fieldValidation.error ?? ''}</span>
          </label>
        );
      })}
      <button
        type="button"
        onClick={onSubmit}
        disabled={!validation.isValid || isLoading}
        className="mt-[18px] shrink-0 rounded bg-cyan-500/20 px-3 py-1.5 text-xs text-cyan-300 transition-colors hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/30"
      >
        확인
      </button>
    </div>
  );
}
