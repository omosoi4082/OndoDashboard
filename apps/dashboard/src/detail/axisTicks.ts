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
