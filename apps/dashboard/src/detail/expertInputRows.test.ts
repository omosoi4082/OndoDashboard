import { describe, expect, it } from 'vitest';
import {
  EXPERT_RH_MAX,
  EXPERT_RH_MIN,
  EXPERT_TEMP_MAX,
  EXPERT_TEMP_MIN,
  EXPERT_VENT_MAX,
  EXPERT_VENT_MIN,
} from '../config/constants.js';
import { expertEmptyDrafts, expertExampleDrafts, expertRowLabels, hasAnyExpertInput } from './expertInputRows.js';
import { type ExpertInputFieldRange, validateExpertRows } from './expertInputValidation.js';

describe('expertRowLabels', () => {
  it('0시부터 1시간 간격 24개(하루 절대 시각, 2026-10-17 시안)', () => {
    const labels = expertRowLabels(24);
    expect(labels).toHaveLength(24);
    expect(labels[0]).toBe('0시');
    expect(labels[23]).toBe('23시');
  });
});

describe('expertEmptyDrafts', () => {
  it('모든 칸이 빈 문자열로 시작한다(시안: placeholder가 보이는 상태)', () => {
    const drafts = expertEmptyDrafts(24);
    expect(drafts).toHaveLength(24);
    expect(drafts.every((r) => r.temp === '' && r.rh === '' && r.vent === '')).toBe(true);
  });
});

describe('hasAnyExpertInput', () => {
  it('전부 비어 있으면 false — "초기화" 버튼이 안 보이는 상태', () => {
    expect(hasAnyExpertInput(expertEmptyDrafts(24))).toBe(false);
  });

  it('한 칸만 채워도 true', () => {
    const drafts = expertEmptyDrafts(24);
    drafts[5] = { temp: '3', rh: '', vent: '' };
    expect(hasAnyExpertInput(drafts)).toBe(true);
  });

  it('공백만 적은 건 입력으로 보지 않는다', () => {
    const drafts = expertEmptyDrafts(3);
    drafts[0] = { temp: '   ', rh: '', vent: '' };
    expect(hasAnyExpertInput(drafts)).toBe(false);
  });
});

describe('expertExampleDrafts', () => {
  it('온도 측 예시값 24행을 그대로 채운다(2026-10-19 CSV 1행·24행)', () => {
    const drafts = expertExampleDrafts(24);
    expect(drafts).toHaveLength(24);
    expect(drafts[0]).toEqual({ temp: '32.4', rh: '68.3', vent: '100' });
    expect(drafts[23]).toEqual({ temp: '31.5', rh: '71.0', vent: '100' });
  });

  it('예시값은 전부 유효해서 바로 "적용"을 누를 수 있다 — 버튼을 둔 이유', () => {
    const range: ExpertInputFieldRange = {
      tempMin: EXPERT_TEMP_MIN,
      tempMax: EXPERT_TEMP_MAX,
      rhMin: EXPERT_RH_MIN,
      rhMax: EXPERT_RH_MAX,
      ventMin: EXPERT_VENT_MIN,
      ventMax: EXPERT_VENT_MAX,
    };
    expect(validateExpertRows(expertExampleDrafts(24), range, 24).isValid).toBe(true);
  });

  it('채워진 표는 "예시값" 대신 "초기화"가 보이는 상태다', () => {
    expect(hasAnyExpertInput(expertExampleDrafts(24))).toBe(true);
  });

  it('행 수가 예시값보다 많으면 나머지는 빈 칸으로 둔다', () => {
    const drafts = expertExampleDrafts(26);
    expect(drafts).toHaveLength(26);
    expect(drafts[25]).toEqual({ temp: '', rh: '', vent: '' });
  });
});
