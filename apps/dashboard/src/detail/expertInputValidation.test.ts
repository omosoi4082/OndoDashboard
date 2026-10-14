import { describe, expect, it } from 'vitest';
import { validateExpertRows, type ExpertInputFieldRange, type ExpertRowDraft } from './expertInputValidation.js';

const RANGE: ExpertInputFieldRange = {
  tempMin: -30,
  tempMax: 50,
  rhMin: 0,
  rhMax: 100,
  ventMin: 20,
  ventMax: 100,
};

function drafts(n = 24): ExpertRowDraft[] {
  return Array.from({ length: n }, () => ({ temp: '25', rh: '60', vent: '50' }));
}

describe('validateExpertRows', () => {
  it('24행 모두 범위 안이면 isValid=true, values에 숫자 24행', () => {
    const result = validateExpertRows(drafts(), RANGE, 24);
    expect(result.isValid).toBe(true);
    expect(result.firstError).toBeNull();
    expect(result.values).toHaveLength(24);
    expect(result.values?.[0]).toEqual({ temp: 25, rh: 60, vent: 50 });
  });

  it('빈칸이 하나라도 있으면 문구 없이 실패한다', () => {
    const d = drafts();
    d[3] = { temp: '', rh: '60', vent: '50' };
    const result = validateExpertRows(d, RANGE, 24);
    expect(result.isValid).toBe(false);
    expect(result.values).toBeNull();
    expect(result.firstError).toBeNull();
    expect(result.rows[3]?.temp).toEqual({ value: null, error: null });
  });

  it('숫자가 아니거나 범위 밖이면 칸 오류 + 첫 오류 문구(행 번호·항목명 포함)', () => {
    const d = drafts();
    d[2] = { temp: 'abc', rh: '60', vent: '50' };
    d[5] = { temp: '25', rh: '60', vent: '10' };
    const result = validateExpertRows(d, RANGE, 24);
    expect(result.isValid).toBe(false);
    expect(result.rows[2]?.temp.error).toBe('-30℃ ~ 50℃ 의 값을 입력해 주세요.');
    expect(result.rows[5]?.vent.error).toBe('20% ~ 100% 의 값을 입력해 주세요.');
    expect(result.firstError).toBe('3행 온도: -30℃ ~ 50℃ 의 값을 입력해 주세요.');
  });

  it('범위 끝값은 통과한다', () => {
    const d = drafts().map((_, i) => (i % 2 === 0 ? { temp: '-30', rh: '0', vent: '20' } : { temp: '50', rh: '100', vent: '100' }));
    expect(validateExpertRows(d, RANGE, 24).isValid).toBe(true);
  });

  it('행 수가 rowCount와 다르면 실패', () => {
    expect(validateExpertRows(drafts(23), RANGE, 24).isValid).toBe(false);
  });

  it('앞뒤 공백은 무시한다', () => {
    const d = drafts();
    d[0] = { temp: ' 25.5 ', rh: '60', vent: '50' };
    expect(validateExpertRows(d, RANGE, 24).values?.[0]?.temp).toBe(25.5);
  });
});
