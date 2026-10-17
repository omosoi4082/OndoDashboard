import { describe, expect, it } from 'vitest';
import { expertEmptyDrafts, expertRowLabels, hasAnyExpertInput } from './expertInputRows.js';

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
