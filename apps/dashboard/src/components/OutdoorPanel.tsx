// 외부환경(3) — 3-1 기상청 실황 + 3-2 미세기후 (01-functional-spec.md 2장). 스타일·크기는
// docs/06-design-guide.md "외부환경"(디자인 원본 실측: 블록 폭 338, 타일 81×66, 간격 5).
// 타일 4칸: 풍향·풍속·습도·강수량. 풍속(양쪽)·기상청 강수량은 아직 API에 없어 '-'
// (05-open-questions.md #36, 사용자가 온도 측 확인 중).
import type { ReactElement, ReactNode } from 'react';
import type { WeatherCode } from '@ondo/shared';
import { okData } from '../api/client.js';
import { useMainStore } from '../store/mainStore.js';
import { getWeatherIcon } from '../weather/weatherIcon.js';
import { HumidityTileIcon, RainAmountIcon, WindDirectionIcon, WindSpeedIcon } from '../icons/designIcons.js';

function WeatherIcon({ code, isNight }: { code: WeatherCode | null; isNight: boolean }): ReactElement {
  const icon = getWeatherIcon(code, isNight);
  if (!icon) return <span className="text-sm text-ondo-muted">-</span>;
  return <img src={icon.src} alt={icon.label} title={icon.label} className="h-[18px] w-[18px]" />;
}

function Tile({ icon, value, unit }: { icon: ReactNode; value: string | null; unit?: string }): ReactElement {
  return (
    <div className="flex h-[66px] w-[81px] flex-col justify-between rounded-[3px] border border-ondo-border bg-ondo-surface/80 px-3 pb-2.5 pt-3.5">
      <span className="text-white">{icon}</span>
      <span className="text-base leading-none text-white">
        {value ?? '-'}
        {value !== null && unit && <span className="ml-1 text-sm text-ondo-muted">{unit}</span>}
      </span>
    </div>
  );
}

function num(value: number | null, digits: number): string | null {
  return value === null ? null : value.toFixed(digits);
}

interface WeatherBlockProps {
  title: string;
  disconnected: boolean;
  weatherCode: WeatherCode | null;
  isNight: boolean;
  temp: number | null;
  rh: number | null;
  windDir: string | null;
  windDeg: number | null;
  windSpeed: number | null;
  rain: number | null;
}

function WeatherBlock(props: WeatherBlockProps): ReactElement {
  const { title, disconnected, weatherCode, isNight, temp, rh, windDir, windDeg, windSpeed, rain } = props;
  return (
    <div className="flex w-[338px] flex-col gap-[17px]">
      <div className="flex h-5 items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-[3px] bg-ondo-accent-bar" />
          <span className="text-base font-bold text-white">{title}</span>
          {disconnected && <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">연결 끊김</span>}
        </div>
        <div className="flex items-center gap-3">
          <WeatherIcon code={weatherCode} isNight={isNight} />
          <span className="text-lg font-semibold text-white">
            {temp === null ? '-' : temp.toFixed(1)}
            <span className="ml-0.5 text-xs font-normal">℃</span>
          </span>
        </div>
      </div>
      <div className="flex gap-[5px]">
        {/* 풍향: windDeg(바람이 불어오는 방위, docs/03 3장)만큼 북쪽 기준으로 화살표를 돌린다 —
            디자인의 북서풍(↖)·북풍(↑) 예시와 같은 규칙. 글자는 명세대로 16방위. */}
        <Tile
          icon={<WindDirectionIcon size={16} style={{ transform: `rotate(${windDeg ?? 0}deg)` }} />}
          value={windDir}
        />
        <Tile icon={<WindSpeedIcon size={16} />} value={num(windSpeed, 1)} unit="m/s" />
        <Tile icon={<HumidityTileIcon size={16} />} value={num(rh, 0)} unit="%" />
        <Tile icon={<RainAmountIcon size={16} />} value={num(rain, 1)} unit="mm" />
      </div>
    </div>
  );
}

export function OutdoorPanel(): ReactElement {
  const kma = okData(useMainStore((s) => s.weatherKma));
  const station = okData(useMainStore((s) => s.weatherStation));

  return (
    <div className="flex flex-col gap-[37px]">
      <WeatherBlock
        title={kma?.label ?? '기상청 실황'}
        disconnected={kma?.sourceStatus === 'disconnected'}
        weatherCode={kma?.weatherCode ?? null}
        isNight={kma?.isNight ?? false}
        temp={kma?.temp ?? null}
        rh={kma?.rh ?? null}
        windDir={kma?.windDir ?? null}
        windDeg={kma?.windDeg ?? null}
        windSpeed={null}
        rain={null}
      />
      <WeatherBlock
        title={station?.label ?? '미세기후'}
        disconnected={station?.sourceStatus === 'disconnected'}
        weatherCode={station?.weatherCode ?? null}
        isNight={station?.isNight ?? false}
        temp={station?.temp ?? null}
        rh={station?.rh ?? null}
        windDir={station?.windDir ?? null}
        windDeg={station?.windDeg ?? null}
        windSpeed={null}
        rain={station?.rain ?? null}
      />
    </div>
  );
}
