import { describe, expect, it } from 'vitest';
import type { DetailFrame } from '@ondo/shared';
import { QUALITY_OUT_OF_RANGE_TEXT, qualityNotice } from './qualityNotice.js';

function frameWith(quality: DetailFrame['quality']): DetailFrame {
  return {
    offsetMin: 0,
    time: '2026-08-03T14:20:00+09:00',
    points: { temp: [], rh: [], flow: [] },
    grid: { temp: [], rh: [] },
    flow: [],
    outdoor: { T_out: 32.4, RH_out: 68.3, fan_pct: 100 },
    summary: {
      T_mean: 31,
      T_min: 30,
      T_max: 32,
      T_west: 31,
      T_east: 31,
      RH_mean: 80,
      V_mean: 0.03,
      V_max: 0.6,
    },
    quality,
  };
}

describe('qualityNotice', () => {
  it('범위 안이면 알림이 없다(목업 v4는 전 프레임이 이 경우다)', () => {
    expect(qualityNotice(frameWith({ in_range: true, warnings: [] }))).toBeNull();
  });

  it('프레임이 없으면 null', () => {
    expect(qualityNotice(null)).toBeNull();
    expect(qualityNotice(undefined)).toBeNull();
  });

  it('범위 밖이면 연산 서버 warnings를 그대로 보여 준다', () => {
    const notice = qualityNotice(frameWith({ in_range: false, warnings: ['외기 온도가 학습 범위를 넘습니다.'] }));
    expect(notice).toBe('참고용 — 외기 온도가 학습 범위를 넘습니다.');
  });

  it('warnings가 비어 있으면 기본 문구를 쓴다', () => {
    expect(qualityNotice(frameWith({ in_range: false, warnings: [] }))).toBe(`참고용 — ${QUALITY_OUT_OF_RANGE_TEXT}`);
  });

  it('warnings가 여럿이면 한 줄로 이어 붙인다', () => {
    expect(qualityNotice(frameWith({ in_range: false, warnings: ['가.', '나.'] }))).toBe('참고용 — 가. 나.');
  });

  it('문구에 이미 "참고용"이 들어 있으면 앞말을 덧붙이지 않는다', () => {
    const notice = qualityNotice(
      frameWith({ in_range: false, warnings: ['입력 조건이 검증 범위를 벗어났습니다(참고용).'] }),
    );
    expect(notice).toBe('입력 조건이 검증 범위를 벗어났습니다(참고용).');
  });

  it('빈 문자열·공백만 있는 warnings는 무시한다', () => {
    expect(qualityNotice(frameWith({ in_range: false, warnings: ['', '  '] }))).toBe(
      `참고용 — ${QUALITY_OUT_OF_RANGE_TEXT}`,
    );
  });
});
