import { describe, expect, it } from 'vitest';
import { validateExpertInput, type ExpertInputFieldRange } from './expertInputValidation.js';

const RANGE: ExpertInputFieldRange = {
  tempMin: -30,
  tempMax: 50,
  rhMin: 0,
  rhMax: 100,
  ventMin: 20,
  ventMax: 100,
};

describe('validateExpertInput', () => {
  it('세 필드 모두 범위 안이면 isValid=true, value에 숫자가 채워진다', () => {
    const result = validateExpertInput({ temp: '25', rh: '60', vent: '50' }, RANGE);
    expect(result.isValid).toBe(true);
    expect(result.temp).toEqual({ value: 25, error: null });
    expect(result.rh).toEqual({ value: 60, error: null });
    expect(result.vent).toEqual({ value: 50, error: null });
  });

  it('빈 값은 범위 안내 문구와 함께 실패한다', () => {
    const result = validateExpertInput({ temp: '', rh: '60', vent: '50' }, RANGE);
    expect(result.isValid).toBe(false);
    expect(result.temp.value).toBeNull();
    expect(result.temp.error).toBe('범위: -30~50');
  });

  it('숫자가 아니면 "숫자를 입력하세요" 문구를 돌려준다', () => {
    const result = validateExpertInput({ temp: 'abc', rh: '60', vent: '50' }, RANGE);
    expect(result.isValid).toBe(false);
    expect(result.temp.error).toBe('숫자를 입력하세요');
  });

  it('범위를 벗어나면 실패한다', () => {
    const tooLow = validateExpertInput({ temp: '-31', rh: '60', vent: '50' }, RANGE);
    expect(tooLow.isValid).toBe(false);
    expect(tooLow.temp.error).toBe('범위: -30~50');

    const tooHigh = validateExpertInput({ temp: '25', rh: '60', vent: '101' }, RANGE);
    expect(tooHigh.isValid).toBe(false);
    expect(tooHigh.vent.error).toBe('범위: 20~100');
  });

  it('경계값(최솟값·최댓값)은 통과한다', () => {
    const atMin = validateExpertInput({ temp: '-30', rh: '0', vent: '20' }, RANGE);
    expect(atMin.isValid).toBe(true);
    const atMax = validateExpertInput({ temp: '50', rh: '100', vent: '100' }, RANGE);
    expect(atMax.isValid).toBe(true);
  });

  it('앞뒤 공백은 trim 후 검사한다', () => {
    const result = validateExpertInput({ temp: ' 25 ', rh: '60', vent: '50' }, RANGE);
    expect(result.temp).toEqual({ value: 25, error: null });
  });
});
