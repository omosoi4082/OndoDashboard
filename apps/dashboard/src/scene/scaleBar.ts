// 축척(스케일 바) 계산 — 순수 함수. 1 unit = 1 m(01-functional-spec.md 2장 #8).
// 카메라 거리(dolly) 변화에 따라 화면상 1m가 몇 픽셀인지 구하고, 보기 좋은 "눈금" 길이를
// 골라 막대 픽셀 길이를 역산한다(지도 축척 막대와 같은 방식).

/** 카메라-타겟 거리와 수직 FOV로, 화면 1px에 해당하는 실제 길이(m)를 구한다. */
export function metersPerPixel(distance: number, verticalFovDeg: number, canvasHeightPx: number): number {
  const fovRad = (verticalFovDeg * Math.PI) / 180;
  const visibleHeightMeters = 2 * distance * Math.tan(fovRad / 2);
  return visibleHeightMeters / canvasHeightPx;
}

// 막대 길이로 쓸 "보기 좋은" m 단위 후보 — 개발자 결정(디자인 가이드 미수신, #23).
export const NICE_SCALE_STEPS_M: readonly number[] = [0.5, 1, 2, 5, 10, 20, 50, 100];

/** metersPerPx 기준으로, targetPx에 가장 가까운 픽셀 길이가 되는 "보기 좋은" m 값을 고른다. */
export function pickScaleBar(
  metersPerPx: number,
  targetPx = 120,
): { meters: number; px: number } {
  let best = NICE_SCALE_STEPS_M[0];
  let bestDiff = Infinity;
  for (const meters of NICE_SCALE_STEPS_M) {
    const px = meters / metersPerPx;
    const diff = Math.abs(px - targetPx);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = meters;
    }
  }
  return { meters: best, px: best / metersPerPx };
}
