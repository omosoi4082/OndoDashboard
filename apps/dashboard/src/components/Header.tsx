// 상단 헤더 — 위치(기상청 동네 이름) + 로고(1) + 날짜·요일·시간(2). 01-functional-spec.md 2장,
// 스타일은 docs/06-design-guide.md "헤더". 로고는 docs/design/logo/로고-light.svg 복사본.
import { useEffect, useState, type ReactElement } from 'react';
import { LocationPinIcon } from '../icons/designIcons.js';
import { CLOCK_TICK_INTERVAL_MS } from '../config/constants.js';
import { formatHeaderDate, formatHeaderTime, formatHeaderWeekday } from '../utils/formatDateTime.js';
import { okData } from '../api/client.js';
import { useMainStore } from '../store/mainStore.js';

export function Header(): ReactElement {
  const [now, setNow] = useState(() => new Date());
  const areaName = okData(useMainStore((s) => s.weatherKma))?.areaName ?? null;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="pointer-events-none relative flex h-[74px] shrink-0 items-center justify-between px-[42px]">
      <div className="flex items-center gap-2.5 text-[15px] text-white">
        <LocationPinIcon size={18} />
        <span>{areaName ?? '-'}</span>
      </div>
      <img src="/assets/logo/logo-light.svg" alt="온도" className="absolute left-1/2 h-[42px] -translate-x-1/2" />
      {/* 날짜·요일·시각 각각 별도 칸, 간격 12px, 전부 SemiBold(Figma node 307:10016~10019,
          2026-10-10 재확인 — 기존엔 날짜+요일을 한 덩어리로 합치고 간격 18px·날짜만 medium이라
          시안과 달랐음). */}
      <div className="flex items-center gap-[12px] tabular-nums text-white">
        <span className="text-[16px] font-semibold tracking-[-0.32px]">{formatHeaderDate(now)}</span>
        <span className="text-[16px] font-semibold tracking-[-0.32px]">{formatHeaderWeekday(now)}</span>
        <time className="text-[22px] font-semibold tracking-[1.32px]">{formatHeaderTime(now)}</time>
      </div>
    </header>
  );
}
