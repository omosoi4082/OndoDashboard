// 전문가 모드 입력 필드(21) — 01-functional-spec.md 4.3: 온도·습도·환기량 3개 + 적용
// 버튼. 유효성 검사(detail/expertInputValidation.ts)를 통과 못 하면 적용 버튼 비활성화 +
// 필드 옆 안내 문구를 보여준다. 입력값 자체는 ExpertModeView.tsx가 들고 있다(모드 탭을
// 벗어나면 같이 사라지는 폼 상태라 전역 store에 둘 필요가 없다고 판단).
// 스타일은 Figma node 374:11619·374:12903·374:13401(03_전문가모드_디자인 01~03) 실측값 —
// "필수값 설정" 타이틀 + 입력칸(184px 고정 폭, placeholder "값을 입력해주세요.") + 버튼
// "적용". 입력칸 우측 위아래 화살표는 디자인엔 있지만 증감 폭·동작이 정의돼 있지 않아
// 모양만 그대로 옮기고 동작은 아직 안 붙였다(05-open-questions.md에 항목 추가 — 온도 측
// 확인 필요).
import type { ReactElement } from 'react';
import type { ExpertInputDraft, ExpertInputValidation } from '../../detail/expertInputValidation.js';

interface ExpertInputFormProps {
  draft: ExpertInputDraft;
  validation: ExpertInputValidation;
  isLoading: boolean;
  /** 현재 입력값으로 이미 결과를 받아온 상태인지 — 버튼 문구를 "적용 완료"로 바꾼다
   * (Figma node 374:12650 "03_전문가모드_디자인_05" 실측). */
  isApplied: boolean;
  onChange: (next: ExpertInputDraft) => void;
  onSubmit: () => void;
}

// 환기량 단위는 05-open-questions.md #11에서 "가동률 %"로 확정(2026-10-07, 센서·연산
// 입력과 단위 통일 목적). Figma 시안엔 "cmm"으로 적혀 있어 명세와 다르다 — 확정 답변이
// 우선이라 %를 그대로 쓰고 불일치는 온도 측에 재확인 요청(05-open-questions.md #41).
const FIELDS: ReadonlyArray<{ key: keyof ExpertInputDraft; label: string; unit: string }> = [
  { key: 'temp', label: '온도', unit: '℃' },
  { key: 'rh', label: '습도', unit: '%' },
  { key: 'vent', label: '환기량', unit: '%' },
];

// Figma node 374:13030/13515(Frame 5·6) 실측 — 42×16 알약 모양 배경(#474951 30%) + 삼각형
// 화살표(#CCCCCC 70%). 아래쪽 화살표는 원본 SVG를 180도 돌려서 쓴다(시안과 동일).
function StepperArrow({ flipped }: { flipped?: boolean }): ReactElement {
  return (
    <svg width="42" height="16" viewBox="0 0 42 16" fill="none" className={flipped ? 'rotate-180' : undefined} aria-hidden>
      <path d="M0 4C0 1.79086 1.79086 0 4 0H38C40.2091 0 42 1.79086 42 4V16H0V4Z" fill="#474951" fillOpacity="0.3" />
      <path
        d="M20.2965 4.69624C20.6862 4.31056 21.3138 4.31056 21.7035 4.69624L25.3337 8.28926C25.9687 8.91772 25.5236 10 24.6303 10H17.3697C16.4764 10 16.0313 8.91772 16.6663 8.28926L20.2965 4.69624Z"
        fill="#CCCCCC"
        fillOpacity="0.7"
      />
    </svg>
  );
}

export function ExpertInputForm({ draft, validation, isLoading, isApplied, onChange, onSubmit }: ExpertInputFormProps): ReactElement {
  return (
    <div className="flex shrink-0 flex-col gap-4">
      <span className="text-sm font-semibold text-[#ccc]">필수값 설정</span>
      <div className="flex items-start gap-5">
        {FIELDS.map((field) => {
          const fieldValidation = validation[field.key];
          return (
            <div key={field.key} className="flex w-[184px] shrink-0 flex-col gap-1.5">
              <span className="text-sm font-semibold text-[#ccc]">
                {field.label}({field.unit})
              </span>
              <div
                className={`flex h-[42px] items-center gap-4 rounded-md border pl-3 pr-1 focus-within:border-[#555] focus-within:bg-transparent ${
                  fieldValidation.error
                    ? 'border-[rgba(255,105,91,0.5)] bg-[rgba(255,105,91,0.05)]'
                    : 'border-[rgba(85,85,85,0.5)] bg-[rgba(71,73,81,0.1)]'
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
                <div className="flex h-[34px] shrink-0 flex-col items-center justify-between">
                  <StepperArrow />
                  <StepperArrow flipped />
                </div>
              </div>
              <span className="h-3 whitespace-nowrap text-[10px] text-[#ff695b]">{fieldValidation.error ?? ''}</span>
            </div>
          );
        })}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!validation.isValid || isLoading || isApplied}
          className="ml-1 mt-[26px] h-[42px] w-[92px] shrink-0 rounded-lg border border-[#1088de] bg-[#1088de] text-sm font-medium text-white transition-colors hover:bg-[#1088de]/80 disabled:cursor-not-allowed disabled:border-[rgba(85,85,85,0.3)] disabled:bg-[rgba(71,73,81,0.3)] disabled:text-[rgba(255,255,255,0.3)]"
        >
          {isApplied ? '적용 완료' : '적용'}
        </button>
      </div>
    </div>
  );
}
