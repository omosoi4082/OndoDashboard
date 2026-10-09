// 상단 헤더 — 위치(기상청 동네 이름) + 로고(1) + 날짜·요일·시간(2). 01-functional-spec.md 2장,
// 스타일은 docs/06-design-guide.md "헤더". 로고는 docs/design/logo/로고-light.svg 복사본.
import { useEffect, useState, type ReactElement } from 'react';
import { MapPin } from 'lucide-react';
import { CLOCK_TICK_INTERVAL_MS } from '../config/constants.js';
import { formatHeaderDate, formatHeaderTime } from '../utils/formatDateTime.js';
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
    <header className="relative flex h-[74px] shrink-0 items-center justify-between px-[42px]">
      <div className="flex items-center gap-2.5 text-[15px] text-white">
        <MapPin size={18} fill="currentColor" stroke="var(--color-ondo-bg)" />
        <span>{areaName ?? '-'}</span>
      </div>
      <img src="/assets/logo/logo-light.svg" alt="온도" className="absolute left-1/2 h-[42px] -translate-x-1/2" />
      <div className="flex items-baseline gap-[18px] tabular-nums text-white">
        <span className="text-[15px] font-medium">{formatHeaderDate(now)}</span>
        <time className="text-[22px] font-semibold tracking-wide">{formatHeaderTime(now)}</time>
      </div>
    </header>
  );
}
