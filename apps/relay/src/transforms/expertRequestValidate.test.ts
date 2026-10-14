import { describe, expect, it } from 'vitest';
import { EXPERT_INPUT_ROW_COUNT, validateExpertRequest, type ExpertInputRange } from './expertRequestValidate.js';

const RANGE: ExpertInputRange = { tempMin: -30, tempMax: 50, rhMin: 0, rhMax: 100, ventMin: 20, ventMax: 100 };

function rows(n = EXPERT_INPUT_ROW_COUNT): { temp: number; rh: number; vent: number }[] {
  return Array.from({ length: n }, (_, i) => ({ temp: 20 + i * 0.1, rh: 60, vent: 50 }));
}

describe('validateExpertRequest', () => {
  it('24행 모두 범위 안이면 통과하고 값을 그대로 돌려준다', () => {
    const body = { rows: rows() };
    const result = validateExpertRequest(body, RANGE);
    expect(result).toEqual({ ok: true, data: body });
  });

  it('범위 끝값(-30·50, 0·100, 20·100)은 통과한다', () => {
    const body = { rows: rows().map((r, i) => (i % 2 === 0 ? { temp: -30, rh: 0, vent: 20 } : { temp: 50, rh: 100, vent: 100 })) };
    expect(validateExpertRequest(body, RANGE).ok).toBe(true);
  });

  it('rows가 없거나 배열이 아니면 실패', () => {
    expect(validateExpertRequest(undefined, RANGE).ok).toBe(false);
    expect(validateExpertRequest({}, RANGE).ok).toBe(false);
    expect(validateExpertRequest({ rows: 'x' }, RANGE).ok).toBe(false);
  });

  it('24행이 아니면 실패', () => {
    expect(validateExpertRequest({ rows: rows(23) }, RANGE).ok).toBe(false);
    expect(validateExpertRequest({ rows: rows(25) }, RANGE).ok).toBe(false);
  });

  it('빈칸(null·누락·문자열)은 실패하고 행·필드를 알려준다', () => {
    const withNull = rows();
    withNull[5] = { temp: 20, rh: null, vent: 50 } as unknown as { temp: number; rh: number; vent: number };
    const result = validateExpertRequest({ rows: withNull }, RANGE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('rows[5].rh');

    const withString = rows();
    withString[0] = { temp: '20', rh: 60, vent: 50 } as unknown as { temp: number; rh: number; vent: number };
    expect(validateExpertRequest({ rows: withString }, RANGE).ok).toBe(false);
  });

  it('범위 밖이면 실패(환기량 20 미만)', () => {
    const r = rows();
    r[23] = { temp: 20, rh: 60, vent: 19 };
    const result = validateExpertRequest({ rows: r }, RANGE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('rows[23].vent');
  });

  it('여분 필드는 버린다', () => {
    const r = rows().map((row) => ({ ...row, extra: 1 }));
    const result = validateExpertRequest({ rows: r }, RANGE);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.rows[0]).toEqual({ temp: 20, rh: 60, vent: 50 });
  });
});
