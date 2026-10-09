// 상단 날짜·요일·시간 표시(01-functional-spec.md 2장 #2). 예: 2026년 10월 05일 (월) 15:30:24
const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatKoreanDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const weekday = WEEKDAYS_KO[date.getDay()];
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${y}년 ${m}월 ${d}일 (${weekday}) ${hh}:${mm}:${ss}`;
}
