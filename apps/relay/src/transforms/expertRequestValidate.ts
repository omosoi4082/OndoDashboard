// docs/02-relay-api.md 6장 POST /api/detail/expert 본문 검증(B-2). 대시보드 입력 표에서도 같은
// 범위를 검사하지만 직접 호출(curl 등) 대비 중계 서버도 재확인한다(docs/05-open-questions.md #11).
// 규칙: rows 정확히 24행, 각 행 temp·rh·vent 모두 숫자(빈칸·null 불허), 범위는 .env의 EXPERT_*.
import type { ExpertInputRow, ExpertRequest } from '@ondo/shared';

/** 24행 = 1시간 간격 24시간(B-2). 명세 고정값이라 .env로 빼지 않는다. */
export const EXPERT_INPUT_ROW_COUNT = 24;

export interface ExpertInputRange {
  tempMin: number;
  tempMax: number;
  rhMin: number;
  rhMax: number;
  ventMin: number;
  ventMax: number;
}

export type ExpertRequestValidation = { ok: true; data: ExpertRequest } | { ok: false; message: string };

const FIELDS: ReadonlyArray<{ key: keyof ExpertInputRow; min: keyof ExpertInputRange; max: keyof ExpertInputRange }> = [
  { key: 'temp', min: 'tempMin', max: 'tempMax' },
  { key: 'rh', min: 'rhMin', max: 'rhMax' },
  { key: 'vent', min: 'ventMin', max: 'ventMax' },
];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateExpertRequest(body: unknown, range: ExpertInputRange): ExpertRequestValidation {
  if (!isRecord(body) || !Array.isArray(body.rows)) {
    return { ok: false, message: '요청 본문에 rows 배열이 필요합니다.' };
  }
  if (body.rows.length !== EXPERT_INPUT_ROW_COUNT) {
    return { ok: false, message: `rows는 ${EXPERT_INPUT_ROW_COUNT}행이어야 합니다(받은 행 수: ${body.rows.length}).` };
  }

  const rows: ExpertInputRow[] = [];
  for (const [i, raw] of body.rows.entries()) {
    if (!isRecord(raw)) {
      return { ok: false, message: `rows[${i}]는 {temp, rh, vent} 객체여야 합니다.` };
    }
    const row: ExpertInputRow = { temp: 0, rh: 0, vent: 0 };
    for (const f of FIELDS) {
      const v = raw[f.key];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        return { ok: false, message: `rows[${i}].${f.key}는 숫자로 필수 입력해야 합니다.` };
      }
      const min = range[f.min];
      const max = range[f.max];
      if (v < min || v > max) {
        return { ok: false, message: `rows[${i}].${f.key}는 ${min}~${max} 범위여야 합니다(받은 값: ${v}).` };
      }
      row[f.key] = v;
    }
    rows.push(row);
  }
  return { ok: true, data: { rows } };
}
