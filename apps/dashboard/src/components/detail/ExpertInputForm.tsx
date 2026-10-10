// 전문가 모드 입력 필드(21) — 01-functional-spec.md 4.3: 온도·습도·환기량 3개 + 적용
// 버튼. 유효성 검사(detail/expertInputValidation.ts)를 통과 못 하면 적용 버튼 비활성화 +
// 필드 옆 안내 문구를 보여준다. 입력값 자체는 ExpertModeView.tsx가 들고 있다(모드 탭을
// 벗어나면 같이 사라지는 폼 상태라 전역 store에 둘 필요가 없다고 판단).
// 스타일은 Figma node 374:11619(03_전문가모드_디자인) 실측값 — "필수값 설정" 타이틀 +
// 입력칸(placeholder "값을 입력해주세요.") + 버튼 "적용". 입력칸 우측 위아래 화살표는
// 디자인엔 있지만 증감 폭·동작이 정의돼 있지 않아 시각 요소만 두고 동작은 아직 안 붙였다
// (05-open-questions.md에 항목 추가 — 온도 측 확인 필요).
import type { ReactElement } from 'react';
import type { ExpertInputDraft, ExpertInputValidation } from '../../detail/expertInputValidation.js';

interface ExpertInputFormProps {
  draft: ExpertInputDraft;
  validation: ExpertInputValidation;
  isLoading: boolean;
  onChange: (next: ExpertInputDraft) => void;
  onSubmit: () => void;
}

// 환기량 단위는 05-open-questions.md #11에서 "가동률 %"로 확정(2026-10-07, 센서·연산
// 입력과 단위 통일 목적). Figma 시안엔 "cmm"으로 적혀 있어 명세와 다르다 — 확정 답변이
// 우선이라 %를 그대로 쓰고 불일치는 온도 측에 재확인 요청(05-open-questions.md 추가 항목).
const FIELDS: ReadonlyArray<{ key: keyof ExpertInputDraft; label: string; unit: string }> = [
  { key: 'temp', label: '온도', unit: '℃' },
  { key: 'rh', label: '습도', unit: '%' },
  { key: 'vent', label: '환기량', unit: '%' },
];

export function ExpertInputForm({ draft, validation, isLoading, onChange, onSubmit }: ExpertInputFormProps): ReactElement {
  return (
    <div className="flex shrink-0 flex-col gap-4">
      <span className="text-sm font-semibold text-[#ccc]">필수값 설정</span>
      <div className="flex items-start gap-5">
        {FIELDS.map((field) => {
          const fieldValidation = validation[field.key];
          return (
            <div key={field.key} className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-sm font-semibold text-[#ccc]">
                {field.label}({field.unit})
              </span>
              <div
                className={`flex h-[42px] items-center gap-4 rounded-md border bg-[rgba(71,73,81,0.1)] pl-3 pr-1 ${
                  fieldValidation.error ? 'border-red-500/50' : 'border-[rgba(85,85,85,0.5)]'
                }`}
              >
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft[field.key]}
                  placeholder="값을 입력해주세요."
                  onChange={(e) => onChange({ ...draft, [field.key]: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
                />
                <div className="flex h-[34px] shrink-0 flex-col items-center justify-between text-white/40">
                  <svg width="14" height="8" viewBox="0 0 14 8" fill="none" aria-hidden>
                    <path d="M1 7L7 1L13 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <svg width="14" height="8" viewBox="0 0 14 8" fill="none" aria-hidden>
                    <path d="M1 1L7 7L13 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <span className="h-3 text-[10px] text-red-300">{fieldValidation.error ?? ''}</span>
            </div>
          );
        })}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!validation.isValid || isLoading}
          className="mt-[26px] h-[42px] w-[92px] shrink-0 rounded-lg border border-ondo-accent bg-ondo-accent text-sm font-medium text-white transition-colors hover:bg-ondo-accent/80 disabled:cursor-not-allowed disabled:border-[rgba(85,85,85,0.3)] disabled:bg-[rgba(71,73,81,0.3)] disabled:text-[rgba(255,255,255,0.3)]"
        >
          적용
        </button>
      </div>
    </div>
  );
}
