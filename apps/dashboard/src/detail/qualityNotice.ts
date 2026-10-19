// 프레임 `quality.in_range`가 false일 때 3D 위에 띄우는 "참고용" 알림.
//
// 왜 있나: 연산 서버 API 안내 v1.3.2 4장 — "quality.in_range 가 false 면 화면에 '참고용' 표시,
// 안내 문장은 warnings 에". relay는 `quality`를 그대로 넘기고 있었지만(packages/shared의
// `DetailFrameQuality`) 화면에는 어디에도 나오지 않고 있었다(2026-10-19 확인). 검증 범위 밖
// 조건은 **오류가 아니라 정상 응답**이라 값은 그대로 그리고, 문구만 덧붙인다.
//
// 표시 자리는 `Detail3DView`의 `notice`(위쪽 가운데 작은 문구)를 그대로 쓴다 — 현재 모드가
// "마지막 정상 결과 유지"를 알릴 때 쓰는 자리와 같다(detail/keepLastGood.ts). 시안에 따로
// 그려진 요소가 없어 가장 단순한 쪽으로 맞췄다(05-open-questions.md #53).
import type { DetailFrame } from '@ondo/shared';

/** warnings가 비어 있을 때 쓰는 기본 문구. */
export const QUALITY_OUT_OF_RANGE_TEXT = '입력 조건이 검증 범위를 벗어났습니다.';

/** 알림 문구 앞에 붙이는 말 — 숫자를 그대로 믿지 말라는 뜻이 한눈에 보이게 한다. */
const PREFIX = '참고용';

/**
 * 프레임 하나의 알림 문구. 범위 안이거나 프레임이 없으면 null(알림을 띄우지 않는다).
 * warnings가 여럿이면 한 줄로 이어 붙인다 — 알림 자리가 한 줄이고, 연산 서버가 주는 문장이
 * 짧다(v1.3.2 예시: "입력 조건이 검증 범위를 벗어났습니다(참고용).").
 */
export function qualityNotice(frame: DetailFrame | null | undefined): string | null {
  if (!frame || frame.quality.in_range) return null;
  const warnings = frame.quality.warnings.map((w) => w.trim()).filter((w) => w.length > 0);
  const body = warnings.length > 0 ? warnings.join(' ') : QUALITY_OUT_OF_RANGE_TEXT;
  // 연산 서버 문장이 이미 "(참고용)"을 담고 있으면 두 번 적지 않는다.
  return body.includes(PREFIX) ? body : `${PREFIX} — ${body}`;
}
