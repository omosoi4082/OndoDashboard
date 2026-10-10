// 전문가 모드 입력 필드(21) — 01-functional-spec.md 4.3: 온도·습도·환기량 3개 + 적용
// 버튼. 유효성 검사(detail/expertInputValidation.ts)를 통과 못 하면 적용 버튼 비활성화 +
// 필드 옆 안내 문구를 보여준다. 입력값 자체는 ExpertModeView.tsx가 들고 있다(모드 탭을
// 벗어나면 같이 사라지는 폼 상태라 전역 store에 둘 필요가 없다고 판단).
// 스타일은 Figma node 374:11619·374:12903·374:13401·374:25295(03_전문가모드_디자인
// 01~03, 재확인본 01) 실측값 — "필수값 설정" 타이틀 + 입력칸(184px 고정 폭, placeholder
// "값을 입력해주세요.") + 버튼 "적용". 증감 화살표는 실제로 값을 올리고 내린다(2026-10-10
// 사용자 요청) — 증감 폭은 명세·시안에 정의가 없어 가장 단순하게 온도는 0.1, 습도·환기량은
// 1로 뒀다(05-open-questions.md #41에 기록).
import type { ReactElement } from 'react';
import type { ExpertInputDraft, ExpertInputValidation } from '../../detail/expertInputValidation.js';

interface ExpertInputFormProps {
  draft: ExpertInputDraft;
  validation: ExpertInputValidation;
  isLoading: boolean;
  /** 현재 입력값으로 이미 결과를 받아온 상태인지 — 버튼 문구를 "적용 완료"로 바꾼다
   * (Figma node 374:12650 "03_전문가모드_디자인_05" 실측). 적용 후 입력값을 다시 바꾸면
   * ExpertModeView.tsx가 이 값을 false로 되돌려 버튼이 다시 "적용"으로 바뀐다. */
  isApplied: boolean;
  onChange: (next: ExpertInputDraft) => void;
  onSubmit: () => void;
}

const FIELDS: ReadonlyArray<{ key: keyof ExpertInputDraft; label: string; unit: string; step: number }> = [
  { key: 'temp', label: '온도', unit: '℃', step: 0.1 },
  { key: 'rh', label: '습도', unit: '%', step: 1 },
  // 환기량 단위는 05-open-questions.md #11에서 "가동률 %"로 확정(2026-10-07, 센서·연산
  // 입력과 단위 통일 목적). Figma 시안엔 "cmm"으로 적혀 있어 명세와 다르다 — 확정 답변이
  // 우선이라 %를 그대로 쓰고 불일치는 온도 측에 재확인 요청(05-open-questions.md #41).
  { key: 'vent', label: '환기량', unit: '%', step: 1 },
];

function stepValue(raw: string, delta: number): string {
  const n = Number(raw.trim());
  const base = Number.isFinite(n) ? n : 0;
  // 부동소수 오차(0.1+0.2 같은) 정리 — 둘째 자리까지만 쓴다(소수 첫째 자리 단위 증감이라 충분).
  return String(Math.round((base + delta) * 100) / 100);
}

// Figma node 374:13030/13515(Frame 5·6) 실측 — 42×16 알약 모양 배경(#474951 30%) + 삼각형
// 화살표(#CCCCCC 70%). 아래쪽 화살표는 원본 SVG를 180도 돌려서 쓴다(시안과 동일).
function StepperArrow({ flipped, onClick, label }: { flipped?: boolean; onClick: () => void; label: string }): ReactElement {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="block leading-none">
      <svg width="42" height="16" viewBox="0 0 42 16" fill="none" className={flipped ? 'rotate-180' : undefined} aria-hidden>
        <path d="M0 4C0 1.79086 1.79086 0 4 0H38C40.2091 0 42 1.79086 42 4V16H0V4Z" fill="#474951" fillOpacity="0.3" />
        <path
          d="M20.2965 4.69624C20.6862 4.31056 21.3138 4.31056 21.7035 4.69624L25.3337 8.28926C25.9687 8.91772 25.5236 10 24.6303 10H17.3697C16.4764 10 16.0313 8.91772 16.6663 8.28926L20.2965 4.69624Z"
          fill="#CCCCCC"
          fillOpacity="0.7"
        />
      </svg>
    </button>
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
                  <StepperArrow
                    label={`${field.label} 값 올리기`}
                    onClick={() => onChange({ ...draft, [field.key]: stepValue(draft[field.key], field.step) })}
                  />
                  <StepperArrow
                    flipped
                    label={`${field.label} 값 내리기`}
                    onClick={() => onChange({ ...draft, [field.key]: stepValue(draft[field.key], -field.step) })}
                  />
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
