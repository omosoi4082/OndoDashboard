// 상단 로고(1) + 날짜·요일·시간(2) — 01-functional-spec.md 2장.
// 고해상도 로고는 온도 측 제공 예정(05-open-questions.md #19) — 수신 전까지 placeholder.
import { useEffect, useState, type ReactElement } from 'react';
import { CLOCK_TICK_INTERVAL_MS } from '../config/constants.js';
import { formatKoreanDateTime } from '../utils/formatDateTime.js';

export function Header(): ReactElement {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="flex h-[60px] items-center justify-between border-b border-white/10 bg-[#11151c] px-6">
      <div className="flex items-center gap-3">
        {/* TODO(#19): 온도 제공 고해상도 로고로 교체 */}
        <div className="flex h-9 w-9 items-center justify-center rounded bg-cyan-500/20 text-sm font-bold text-cyan-300">
          온도
        </div>
        <span className="text-sm font-semibold text-white/80">스마트 축사 시뮬레이션 대시보드</span>
      </div>
      <time className="text-sm tabular-nums text-white/70">{formatKoreanDateTime(now)}</time>
    </header>
  );
}
