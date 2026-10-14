// 전문가 모드 입력 표(21, B-2) — 24행(1시간 간격, 첫 행 = 현재 시각 다음 정시) × 온도·습도·
// 환기량 3열 + 적용 버튼. 유효성 검사(detail/expertInputValidation.ts)를 통과 못 하면 적용 버튼
// 비활성화 + 해당 칸 빨간 테두리 + 표 아래 첫 오류 문구. 입력값 자체는 ExpertModeView.tsx가
// 들고 있다(모드 탭을 벗어나면 같이 사라지는 폼 상태라 전역 store에 둘 필요가 없다).
// 24행 표 시안은 아직 없다 — 색·입력칸 테두리·버튼·안내 문구는 기존 3칸 입력 시안(Figma node
// 374:25295 등) 값을 그대로 쓰고, 표 높이는 3D 영역을 가리지 않게 고정하고 표 안에서 스크롤한다.
// 칸마다 증감 화살표를 두면 72개가 돼 표가 복잡해져 화살표는 뺐다(05-open-questions.md #44).
import type { ReactElement } from 'react';
import {
  EXPERT_FIELD_LABELS,
  type ExpertInputValidation,
  type ExpertRowDraft,
} from '../../detail/expertInputValidation.js';
import { formatExpertRowTime } from '../../detail/expertInputRows.js';

interface ExpertInputFormProps {
  rowTimes: Date[];
  drafts: ExpertRowDraft[];
  validation: ExpertInputValidation;
  isLoading: boolean;
  /** 현재 입력값으로 이미 결과를 받아온 상태인지 — 버튼 문구를 "적용 완료"로 바꾼다
   * (Figma node 374:12650 "03_전문가모드_디자인_05" 실측). 적용 후 입력값을 다시 바꾸면
   * ExpertModeView.tsx가 이 값을 false로 되돌려 버튼이 다시 "적용"으로 바뀐다. */
  isApplied: boolean;
  onChange: (next: ExpertRowDraft[]) => void;
  onSubmit: () => void;
}

// 환기량 단위는 환기팬 가동률 %(05-open-questions.md #41 ① 종결, 시안의 'cmm' 폐기).
const COLUMNS: ReadonlyArray<{ key: keyof ExpertRowDraft; unit: string }> = [
  { key: 'temp', unit: '℃' },
  { key: 'rh', unit: '%' },
  { key: 'vent', unit: '%' },
];

const GRID_COLS = 'grid grid-cols-[112px_repeat(3,minmax(0,1fr))] gap-2';

export function ExpertInputForm({ rowTimes, drafts, validation, isLoading, isApplied, onChange, onSubmit }: ExpertInputFormProps): ReactElement {
  function updateCell(rowIndex: number, key: keyof ExpertRowDraft, value: string): void {
    onChange(drafts.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row)));
  }

  return (
    <div className="flex shrink-0 flex-col gap-4">
      <span className="text-sm font-semibold text-[#ccc]">필수값 설정</span>
      <div className="ml-1 flex items-start gap-5">
        <div className="flex w-[592px] shrink-0 flex-col gap-1.5">
          <div className={`${GRID_COLS} pr-[10px] text-sm font-semibold text-[#ccc]`}>
            <span>시각</span>
            {COLUMNS.map((col) => (
              <span key={col.key}>
                {EXPERT_FIELD_LABELS[col.key]}({col.unit})
              </span>
            ))}
          </div>
          <div className="ondo-scrollbar flex max-h-[206px] flex-col gap-1 overflow-y-auto pr-[10px]">
            {drafts.map((row, rowIndex) => {
              const time = rowTimes[rowIndex];
              const rowValidation = validation.rows[rowIndex];
              return (
                <div key={rowIndex} className={`${GRID_COLS} items-center`}>
                  <span className="text-sm text-white/70">{time ? formatExpertRowTime(time) : '-'}</span>
                  {COLUMNS.map((col) => {
                    const hasError = rowValidation?.[col.key].error != null;
                    return (
                      <input
                        key={col.key}
                        type="text"
                        inputMode="decimal"
                        value={row[col.key]}
                        placeholder="값 입력"
                        aria-label={`${time ? formatExpertRowTime(time) : `${rowIndex + 1}행`} ${EXPERT_FIELD_LABELS[col.key]}`}
                        onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
                        className={`h-[30px] min-w-0 rounded-md border px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#555] focus:bg-transparent ${
                          hasError
                            ? 'border-[rgba(255,105,91,0.5)] bg-[rgba(255,105,91,0.05)]'
                            : 'border-[rgba(85,85,85,0.5)] bg-[rgba(71,73,81,0.1)]'
                        }`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
          <span className="h-3 whitespace-nowrap text-[10px] text-[#ff695b]">{validation.firstError ?? ''}</span>
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!validation.isValid || isLoading || isApplied}
          className="mt-[26px] h-[42px] w-[92px] shrink-0 rounded-lg border border-[#1088de] bg-[#1088de] text-sm font-medium text-white transition-colors hover:bg-[#1088de]/80 disabled:cursor-not-allowed disabled:border-[rgba(85,85,85,0.3)] disabled:bg-[rgba(71,73,81,0.3)] disabled:text-[rgba(255,255,255,0.3)]"
        >
          {isApplied ? '적용 완료' : '적용'}
        </button>
      </div>
    </div>
  );
}
