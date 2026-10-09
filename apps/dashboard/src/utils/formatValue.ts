// 값 없음(null)은 화면에 '-'로 표시한다(01-functional-spec.md 2장, 3-1/3-2 규칙).
export function formatValueOrDash(value: number | null, unit: string, digits = 1): string {
  if (value === null) return '-';
  return `${value.toFixed(digits)}${unit}`;
}

export function formatIntOrDash(value: number | null, unit: string): string {
  if (value === null) return '-';
  return `${Math.round(value)}${unit}`;
}
