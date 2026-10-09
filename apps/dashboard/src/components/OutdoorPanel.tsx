// 외부환경(3) — 3-1 기상청 실황 + 3-2 미세기후 (01-functional-spec.md 2장).
import type { ReactElement } from 'react';
import type { KmaWeather, StationWeather } from '@ondo/shared';
import { okData } from '../api/client.js';
import { useMainStore } from '../store/mainStore.js';
import { getWeatherIcon } from '../weather/weatherIcon.js';
import { formatValueOrDash } from '../utils/formatValue.js';

function DisconnectedBadge(): ReactElement {
  return <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">연결 끊김</span>;
}

function WindInfo({ windDir, windDeg }: { windDir: string | null; windDeg: number | null }): ReactElement {
  if (windDir === null || windDeg === null) return <span>풍향 -</span>;
  return <span>풍향 {windDir} ({windDeg}°)</span>;
}

function KmaCard({ kma }: { kma: KmaWeather | null }): ReactElement {
  const icon = kma ? getWeatherIcon(kma.weatherCode, kma.isNight) : null;
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-white/10 bg-[#11151c]/90 p-3 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/70">{kma?.label ?? '기상청 실황'}</span>
        {kma?.sourceStatus === 'disconnected' && <DisconnectedBadge />}
      </div>
      <div className="flex items-center gap-2">
        {icon ? <icon.Icon size={28} aria-label={icon.label} /> : <span className="text-lg">-</span>}
        <span className="text-lg font-semibold">{formatValueOrDash(kma?.temp ?? null, '℃')}</span>
        <span className="text-sm text-white/60">습도 {formatValueOrDash(kma?.rh ?? null, '%')}</span>
      </div>
      <WindInfo windDir={kma?.windDir ?? null} windDeg={kma?.windDeg ?? null} />
    </div>
  );
}

function StationCard({ station }: { station: StationWeather | null }): ReactElement {
  const icon = station ? getWeatherIcon(station.weatherCode, station.isNight) : null;
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-white/10 bg-[#11151c]/90 p-3 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/70">{station?.label ?? '미세기후'}</span>
        {station?.sourceStatus === 'disconnected' && <DisconnectedBadge />}
      </div>
      <div className="flex items-center gap-2">
        {icon ? <icon.Icon size={28} aria-label={icon.label} /> : <span className="text-lg">-</span>}
        <span className="text-lg font-semibold">{formatValueOrDash(station?.temp ?? null, '℃')}</span>
        <span className="text-sm text-white/60">습도 {formatValueOrDash(station?.rh ?? null, '%')}</span>
      </div>
      <WindInfo windDir={station?.windDir ?? null} windDeg={station?.windDeg ?? null} />
      <div className="flex gap-3 text-xs text-white/60">
        <span>강우 {formatValueOrDash(station?.rain ?? null, 'mm')}</span>
        <span>일사 {formatValueOrDash(station?.solar ?? null, 'W/m²')}</span>
      </div>
    </div>
  );
}

export function OutdoorPanel(): ReactElement {
  const weatherKma = useMainStore((s) => s.weatherKma);
  const weatherStation = useMainStore((s) => s.weatherStation);

  const kma = okData(weatherKma);
  const station = okData(weatherStation);

  return (
    <div className="flex flex-row gap-3">
      <KmaCard kma={kma} />
      <StationCard station={station} />
    </div>
  );
}
