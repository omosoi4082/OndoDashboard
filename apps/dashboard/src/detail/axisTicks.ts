// 2D 단면(Detail2DSection) X·Y축 눈금 — 참고 자료(HTML, Plotly 2D 히트맵)처럼 실측 칫수(m)를
// 보여준다(2026-10-10 사용자 요청: "2D단면에 html에서 칫수가 나오잖아 그렇게 표기 해야되").
// "나이스 넘버" 방식(1·2·5의 10의 거듭제곱 배수)으로 축 범위 안에 적당한 간격의 눈금을 고른다.
export function niceAxisTicks(min: number, max: number, targetCount = 5): number[] {
  if (max <= min) return [min];
  const rawStep = (max - min) / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / magnitude;
  const niceNorm = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  const step = niceNorm * magnitude;

  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + step * 1e-6; v += step) {
    ticks.push(Math.round(v / step) * step);
  }
  return ticks;
}

/**
 * niceAxisTicks에 "구간 끝 값"을 반드시 포함시킨 눈금.
 *
 * 2026-10-13 온도 측 B-9: "x축 눈금이 4 m에서 끝나는데 방 폭은 4.5 m입니다." 나이스 넘버
 * 방식은 0~4.5 구간에 간격 1을 골라 0·1·2·3·4로 끝나서, 방이 4 m인 것처럼 보였다.
 * 끝 값(4.5)을 덧붙여 방의 실제 크기가 축에 드러나게 한다.
 *
 * 끝 값이 마지막 눈금과 너무 가까우면(간격의 minGapRatio 미만) 글자가 겹치므로 그 눈금을
 * 끝 값으로 대체한다.
 */
export function axisTicksWithEnd(min: number, max: number, targetCount = 5, minGapRatio = 0.35): number[] {
  // 폭이 없는 축(niceAxisTicks도 [min] 하나만 돌려준다) — 끝 값 하나로 끝낸다.
  if (max <= min) return [max];

  const ticks = niceAxisTicks(min, max, targetCount);
  const last = ticks[ticks.length - 1];
  if (last === undefined) return [max];

  const first = ticks[0];
  const second = ticks[1];
  const step = second !== undefined && first !== undefined ? Math.abs(second - first) : max - min;
  if (step <= 0) return [max];

  // 이미 끝 값이 눈금에 있으면(부동소수 오차 허용) 그대로 둔다.
  if (Math.abs(last - max) < step * 1e-6) return ticks;

  // 끝 값이 마지막 눈금과 너무 가까우면 글자가 겹치므로 그 눈금을 끝 값으로 대체한다.
  if (max - last < step * minGapRatio) {
    return [...ticks.slice(0, -1), max];
  }
  return [...ticks, max];
}
