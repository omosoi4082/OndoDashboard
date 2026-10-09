// 상단 날짜·요일·시간 표시(01-functional-spec.md 2장 #2, docs/06-design-guide.md 헤더).
// 예: 날짜 "2026-10-05 월요일", 시각 "15:30:24"(디자인상 시각만 크게 따로 표시).
const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatHeaderDate(date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d} ${WEEKDAYS_KO[date.getDay()]}요일`;
}

export function formatHeaderTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}
