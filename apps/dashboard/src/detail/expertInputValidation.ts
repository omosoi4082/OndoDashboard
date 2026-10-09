// 전문가 모드 입력 필드(21) 유효성 검사 — 01-functional-spec.md 4.3: "입력 필드에서
// 유효성 검사(숫자 여부, 범위 EXPERT_INPUT_RANGE, 빈 값)를 통과한 값만 전송. 실패 시
// 확인 버튼 비활성화 + 필드 안내 문구". 컴포넌트(ExpertInputForm.tsx)에서 분리해
// 테스트한다(CLAUDE.md 코드 규칙). 범위 상수는 config/constants.ts(EXPERT_TEMP_MIN 등) —
// apps/relay/src/config/env.ts의 같은 이름 기본값과 반드시 일치해야 한다(중계 서버도
// 같은 범위로 재검증, docs/02-relay-api.md 6장).
export interface ExpertInputDraft {
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
  /** null이면 통과. 통과 못 하면 필드 옆에 보여줄 안내 문구. */
  error: string | null;
}

export interface ExpertInputValidation {
  temp: ExpertFieldValidation;
  rh: ExpertFieldValidation;
  vent: ExpertFieldValidation;
  isValid: boolean;
}

function validateField(raw: string, min: number, max: number): ExpertFieldValidation {
  const trimmed = raw.trim();
  if (trimmed === '') return { value: null, error: `범위: ${min}~${max}` };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { value: null, error: '숫자를 입력하세요' };
  if (n < min || n > max) return { value: null, error: `범위: ${min}~${max}` };
  return { value: n, error: null };
}

export function validateExpertInput(draft: ExpertInputDraft, range: ExpertInputFieldRange): ExpertInputValidation {
  const temp = validateField(draft.temp, range.tempMin, range.tempMax);
  const rh = validateField(draft.rh, range.rhMin, range.rhMax);
  const vent = validateField(draft.vent, range.ventMin, range.ventMax);
  return { temp, rh, vent, isValid: temp.error === null && rh.error === null && vent.error === null };
}
