// 전문가 모드 입력 화면(21, B-2) — 24행(0시~23시) × 온도·습도·환기량 3열.
//
// 2026-10-17 새 시안(docs/design/UI/전문가 모드 새 디자인/03_전문가모드_디자인_01~04-1.png) 반영.
// 전과 가장 크게 달라진 점: **입력 표가 상세 패널 전체를 차지하는 하나의 화면**이 됐다.
// 전에는 높이 206px로 고정한 표가 패널 위쪽에 상시 있고 그 아래에 분석 항목·타임라인·3D·2D가
// 같이 보였는데, 시안은 입력 화면과 결과 화면을 나눈다(화면 전환은 ExpertModeView.tsx).
//
// 시안에서 읽은 것:
// - 제목 "필수값 설정". 결과 화면에서 되돌아온 경우에만 제목 왼쪽에 "<" 뒤로 가기(시안 04-1).
// - 우상단 버튼 두 개. "초기화"는 **값을 하나라도 적어야 나타나고**(시안 01에는 없고 02부터 보인다),
//   "적용"은 전 칸이 유효할 때만 파란색으로 활성(시안 04), 그 전에는 회색 비활성(시안 01~03).
// - 칸은 빈 상태로 시작하고 placeholder는 "값을 입력해주세요."
// - 오류는 **문제가 있는 칸 바로 아래 인라인 문구**로 붙고 그 행만 높이가 늘어난다(시안 03).
//   전에는 표 전체 아래에 첫 오류 하나만 보여 줬다. 문구 자체는 expertInputValidation.ts가
//   이미 칸별로 만들어 두고 있어 그대로 쓴다.
import type { ReactElement } from 'react';
import { ChevronLeft } from 'lucide-react';
import {
  EXPERT_FIELD_LABELS,
  type ExpertInputValidation,
  type ExpertRowDraft,
} from '../../detail/expertInputValidation.js';
import { hasAnyExpertInput } from '../../detail/expertInputRows.js';

interface ExpertInputFormProps {
  /** 행 라벨("0시"~"23시"). 길이가 곧 행 수다. */
  rowLabels: readonly string[];
  drafts: ExpertRowDraft[];
  validation: ExpertInputValidation;
  isLoading: boolean;
  /** 결과 화면에서 "필수값 수정"으로 들어온 경우 — 제목 왼쪽 "<"로 결과로 돌아간다(시안 04-1). */
  onBack: (() => void) | null;
  onChange: (next: ExpertRowDraft[]) => void;
  onReset: () => void;
  onSubmit: () => void;
}

// 환기량 단위는 환기팬 가동률 %(05-open-questions.md #41 ① 종결, 시안의 'cmm' 폐기).
const COLUMNS: ReadonlyArray<{ key: keyof ExpertRowDraft; unit: string }> = [
  { key: 'temp', unit: '℃' },
  { key: 'rh', unit: '%' },
  { key: 'vent', unit: '%' },
];

const GRID_COLS = 'grid grid-cols-[56px_repeat(3,minmax(0,1fr))] gap-3';

export function ExpertInputForm({
  rowLabels,
  drafts,
  validation,
  isLoading,
  onBack,
  onChange,
  onReset,
  onSubmit,
}: ExpertInputFormProps): ReactElement {
  function updateCell(rowIndex: number, key: keyof ExpertRowDraft, value: string): void {
    onChange(drafts.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row)));
  }

  const canReset = hasAnyExpertInput(drafts) && !isLoading;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* 제목 줄 — 시안 01(제목+적용), 02~04(제목+초기화+적용), 04-1(뒤로+제목+초기화+적용) */}
      <div className="flex h-[42px] shrink-0 items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="결과 화면으로 돌아가기"
            className="flex h-6 w-6 shrink-0 items-center justify-center text-[#ccc] transition-colors hover:text-white"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <span className="text-[16px] font-semibold text-[#ccc]">필수값 설정</span>

        <div className="ml-auto flex items-center gap-2">
          {canReset && (
            <button
              type="button"
              onClick={onReset}
              className="h-[42px] w-[92px] shrink-0 rounded-lg border border-[rgba(85,85,85,0.5)] bg-[rgba(71,73,81,0.45)] text-sm font-medium text-white transition-colors hover:bg-[rgba(71,73,81,0.7)]"
            >
              초기화
            </button>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!validation.isValid || isLoading}
            className="h-[42px] w-[92px] shrink-0 rounded-lg border border-[#1088de] bg-[#1088de] text-sm font-medium text-white transition-colors hover:bg-[#1088de]/80 disabled:cursor-not-allowed disabled:border-[rgba(85,85,85,0.3)] disabled:bg-[rgba(71,73,81,0.3)] disabled:text-[rgba(255,255,255,0.3)]"
          >
            적용
          </button>
        </div>
      </div>

      <div className="h-px shrink-0 bg-ondo-border" />

      {/* 열 제목 — 시안은 "시간"(전에는 "시각")이다. */}
      <div className={`${GRID_COLS} shrink-0 pr-[10px] text-sm font-semibold text-[#ccc]`}>
        <span>시간</span>
        {COLUMNS.map((col) => (
          <span key={col.key} className="text-center">
            {EXPERT_FIELD_LABELS[col.key]}({col.unit})
          </span>
        ))}
      </div>

      {/* 24행 전부를 패널 높이만큼 펼치고 넘치는 만큼만 스크롤한다(시안 01~04-1: 오른쪽에
          스크롤바가 보이고 표가 패널 바닥까지 내려간다). */}
      <div className="ondo-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-[10px]">
        {drafts.map((row, rowIndex) => {
          const rowValidation = validation.rows[rowIndex];
          return (
            <div key={rowIndex} className={`${GRID_COLS} items-start`}>
              <span className="pt-2 text-sm text-white/70">{rowLabels[rowIndex] ?? `${rowIndex}시`}</span>
              {COLUMNS.map((col) => {
                const error = rowValidation?.[col.key].error ?? null;
                return (
                  <div key={col.key} className="flex min-w-0 flex-col gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row[col.key]}
                      placeholder="값을 입력해주세요."
                      aria-label={`${rowLabels[rowIndex] ?? `${rowIndex}시`} ${EXPERT_FIELD_LABELS[col.key]}`}
                      aria-invalid={error != null}
                      onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
                      className={`h-[34px] min-w-0 rounded-md border px-3 text-center text-sm text-white outline-none placeholder:text-white/30 focus:border-[#555] focus:bg-transparent ${
                        error
                          ? 'border-[rgba(255,105,91,0.7)] bg-[rgba(255,105,91,0.05)]'
                          : 'border-[rgba(85,85,85,0.5)] bg-[rgba(71,73,81,0.1)]'
                      }`}
                    />
                    {/* 시안 03: 문제가 있는 칸 바로 아래에만 문구가 붙고 그 행이 늘어난다. */}
                    {error && <span className="px-1 text-[10px] leading-tight text-[#ff695b]">{error}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
