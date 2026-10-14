// 전문가 모드 입력 표(21, B-2: 24행 × 온도·습도·환기량) 유효성 검사 — 숫자 여부, 범위
// EXPERT_INPUT_RANGE, 빈 값. 한 칸이라도 통과 못 하면 적용 버튼 비활성화 + 안내 문구.
// 컴포넌트(ExpertInputForm.tsx)에서 분리해 테스트한다(CLAUDE.md 코드 규칙). 범위 상수는
// config/constants.ts(EXPERT_TEMP_MIN 등) — apps/relay/src/config/env.ts의 같은 이름 기본값과
// 반드시 일치해야 한다(중계 서버도 같은 범위로 재검증, docs/02-relay-api.md 6장).
import type { ExpertInputRow } from '@ondo/shared';

export interface ExpertRowDraft {
  temp: string;
  rh: string;
  vent: string;
}

export interface ExpertInputFieldRange {
  tempMin: number;
  tempMax: number;
  rhMin: number;
  rhMax: number;
  ventMin: number;
  ventMax: number;
}

export interface ExpertFieldValidation {
  value: number | null;
  /** null이면 통과(또는 빈칸). 값을 적었는데 통과 못 하면 안내 문구. */
  error: string | null;
}

export interface ExpertRowValidation {
  temp: ExpertFieldValidation;
  rh: ExpertFieldValidation;
  vent: ExpertFieldValidation;
}

export interface ExpertInputValidation {
  rows: ExpertRowValidation[];
  /** 모든 칸이 통과했을 때만 전송할 값, 아니면 null. */
  values: ExpertInputRow[] | null;
  /** 표 아래에 보여줄 첫 번째 오류 문구(예: "3행 온도: -30℃ ~ 50℃ 의 값을 입력해 주세요."). */
  firstError: string | null;
  isValid: boolean;
}

export const EXPERT_FIELD_LABELS: Readonly<Record<keyof ExpertRowDraft, string>> = { temp: '온도', rh: '습도', vent: '환기량' };
const FIELD_KEYS: ReadonlyArray<keyof ExpertRowDraft> = ['temp', 'rh', 'vent'];

// 안내 문구 형식은 Figma node 374:13401(03_전문가모드_디자인_03) 실측 그대로:
// "-30℃ ~ 50℃ 의 값을 입력해 주세요." 비어 있을 때는 문구를 안 보여주고(디자인 node
// 374:11616의 빈 상태엔 문구가 없음), 값을 적었는데 범위를 벗어나거나 숫자가 아닐 때만 보여준다.
function validateField(raw: string, min: number, max: number, unit: string): ExpertFieldValidation {
  const trimmed = raw.trim();
  if (trimmed === '') return { value: null, error: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < min || n > max) {
    return { value: null, error: `${min}${unit} ~ ${max}${unit} 의 값을 입력해 주세요.` };
  }
  return { value: n, error: null };
}

function validateRow(draft: ExpertRowDraft, range: ExpertInputFieldRange): ExpertRowValidation {
  return {
    temp: validateField(draft.temp, range.tempMin, range.tempMax, '℃'),
    rh: validateField(draft.rh, range.rhMin, range.rhMax, '%'),
    // 환기량 단위는 환기팬 가동률 %(05-open-questions.md #41 ① 종결, 시안의 'cmm' 폐기).
    vent: validateField(draft.vent, range.ventMin, range.ventMax, '%'),
  };
}

export function validateExpertRows(drafts: ExpertRowDraft[], range: ExpertInputFieldRange, rowCount: number): ExpertInputValidation {
  const rows = drafts.map((d) => validateRow(d, range));

  let firstError: string | null = null;
  const values: ExpertInputRow[] = [];
  let complete = drafts.length === rowCount;
  for (const [i, row] of rows.entries()) {
    for (const key of FIELD_KEYS) {
      const field = row[key];
      if (field.error && firstError === null) firstError = `${i + 1}행 ${EXPERT_FIELD_LABELS[key]}: ${field.error}`;
      if (field.value === null) complete = false;
    }
    if (row.temp.value !== null && row.rh.value !== null && row.vent.value !== null) {
      values.push({ temp: row.temp.value, rh: row.rh.value, vent: row.vent.value });
    }
  }

  return { rows, values: complete ? values : null, firstError, isValid: complete };
}
