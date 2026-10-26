// 외부환경(3) — 3-1 기상청 실황 + 3-2 미세기후 (01-functional-spec.md 2장). 스타일·크기는
// docs/06-design-guide.md "외부환경"(디자인 원본 실측: 블록 폭 338, 타일 82×66, 간격 4,
// 타일 안 아이콘 18×18·아이콘-값 간격 12, 2026-10-10 Figma 재확인).
// 아이콘 크기는 Figma 실측 18×18이었으나 2026-10-26 사용자 지시로 **20×20(10% 확대)**이다
// (타일 82×66·패딩·간격·패널 폭 338은 그대로). App.tsx에서 이 패널 전체를 scale(0.8)로
// 줄이므로 화면에서는 20 × 0.8 = 16px로 보인다.
// 타일 4칸: 풍향·풍속·강수량·습도(2026-10-10 사용자 재확정 — 05-open-questions.md #36의
// 2026-10-09 순서(풍향·풍속·습도·강수량)에서 변경). 풍속·강수량 출처는 기상청 WSD·RN1,
// 기상대 CURWIND·RAIN(05-open-questions.md #36).
import type { ReactElement, ReactNode } from 'react';
import type { WeatherCode } from '@ondo/shared';
import { okData } from '../api/client.js';
import { useMainStore } from '../store/mainStore.js';
import { getWeatherIcon } from '../weather/weatherIcon.js';
import { HumidityDropIcon, RainLinesIcon, WindDirectionIcon, WindSpeedIcon } from '../icons/designIcons.js';

function WeatherIcon({ code, isNight }: { code: WeatherCode | null; isNight: boolean }): ReactElement {
  const icon = getWeatherIcon(code, isNight);
  if (!icon) return <span className="text-sm text-ondo-muted">-</span>;
  // 날씨 아이콘 크기 — Figma 실측 18px → 2026-10-26 "기상청 아이콘들 10%씩" 지시로 20px →
  // 같은 날 "날씨 아이콘만 10% 더" 지시로 22px(20 × 1.1). 타일 아이콘 4종은 20px 그대로다.
  return <img src={icon.src} alt={icon.label} title={icon.label} className="h-[22px] w-[22px]" />;
}

function Tile({ icon, value, unit }: { icon: ReactNode; value: string | null; unit?: string }): ReactElement {
  return (
    <div className="flex h-[66px] w-[82px] items-center rounded-[4px] border border-ondo-border bg-ondo-surface/80 px-[10px] py-[6px]">
      <div className="flex w-[54px] flex-col items-start justify-center gap-[12px]">
        <span className="text-white">{icon}</span>
        <span className="text-base leading-none text-white">
          {value ?? '-'}
          {value !== null && unit && <span className="ml-1 text-sm text-ondo-muted">{unit}</span>}
        </span>
      </div>
    </div>
  );
}

function num(value: number | null, digits: number): string | null {
  return value === null ? null : value.toFixed(digits);
}

interface WeatherBlockProps {
  /** 화면 자동 점검(tests/ui)이 두 블록을 구분하는 손잡이 — 제목 문구는 서버 응답이라 쓰기 어렵다. */
  testId: string;
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
  const { testId, title, disconnected, weatherCode, isNight, temp, rh, windDir, windDeg, windSpeed, rain } = props;
  return (
    <div data-testid={testId} className="flex w-[358px] flex-col gap-[17px]">
      <div className="flex h-5 items-center justify-between">
        <div className="flex items-center gap-[10px]">
          <span className="h-3.5 w-[3px] bg-ondo-accent-bar" />
          <span className="text-base font-bold text-white">{title}</span>
          {disconnected && <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">연결 끊김</span>}
        </div>
        <div className="flex items-center gap-[10px]">
          <WeatherIcon code={weatherCode} isNight={isNight} />
          <span className="text-lg font-semibold text-white">
            {temp === null ? '-' : temp.toFixed(1)}
            <span className="ml-0.5 text-xs font-normal">℃</span>
          </span>
        </div>
      </div>
      <div className="flex gap-[10px]">
        {/* 풍향: windDeg(바람이 불어오는 방위, docs/03 3장)만큼 북쪽 기준으로 화살표를 돌린다 —
            디자인의 북서풍(↖)·북풍(↑) 예시와 같은 규칙. 글자는 명세대로 16방위. */}
        <Tile
          icon={<WindDirectionIcon size={20} style={{ transform: `rotate(${windDeg ?? 0}deg)` }} />}
          value={windDir}
        />
        <Tile icon={<WindSpeedIcon size={20} />} value={num(windSpeed, 1)} unit="m/s" />
        <Tile icon={<RainLinesIcon size={20} />} value={num(rain, 1)} unit="mm" />
        <Tile icon={<HumidityDropIcon size={20} />} value={num(rh, 0)} unit="%" />
      </div>
    </div>
  );
}

// 외부환경 패널 간격 — 2026-10-26 "기상청 모든 갭을 10으로" → 같은 날 "세로갭은 기존 그대로"로
// 정정. 그래서 **가로(행) 간격만 10px**이고 **세로(열) 간격은 Figma 실측값 그대로**다.
//   가로 10px : 타일 4장 사이(실측 4) / 막대↔제목(8) / 날씨아이콘↔기온(12)
//   세로 유지 : 제목↔타일 줄 17 / 타일 안 아이콘↔값 12 / 아라동↔패널 14(App.tsx)
//   예외     : 두 블록 사이는 사용자가 따로 10으로 정했다(실측 37).
// 타일 사이 간격을 4 → 10으로 벌리면 82px 타일 4장이 338px 안에 안 들어와 타일이 줄어들므로
// (82×4 + 10×3 = 358) 블록 폭을 338 → 358로 같이 넓혔다. 타일 치수는 시안값이라 지킨다.
// 기상청 실황 ↔ 미세기후 두 블록 사이 간격(gap-[10px]) — Figma 실측 37px → 2026-10-26
// 사용자 지시로 33px(4px 축소) → 같은 날 10px로 다시 정했다. 좌측 하단으로 내려 80%로
// 축소된 뒤라 화면에서는 10 × 0.8 = 8px로 보인다.
export function OutdoorPanel(): ReactElement {
  const kma = okData(useMainStore((s) => s.weatherKma));
  const station = okData(useMainStore((s) => s.weatherStation));

  return (
    <div className="flex flex-col gap-[10px]">
      <WeatherBlock
        testId="weather-kma"
        title={kma?.label ?? '기상청 실황'}
        disconnected={kma?.sourceStatus === 'disconnected'}
        weatherCode={kma?.weatherCode ?? null}
        isNight={kma?.isNight ?? false}
        temp={kma?.temp ?? null}
        rh={kma?.rh ?? null}
        windDir={kma?.windDir ?? null}
        windDeg={kma?.windDeg ?? null}
        windSpeed={kma?.windSpeed ?? null}
        rain={kma?.rain ?? null}
      />
      <WeatherBlock
        testId="weather-station"
        title={station?.label ?? '미세기후'}
        disconnected={station?.sourceStatus === 'disconnected'}
        weatherCode={station?.weatherCode ?? null}
        isNight={station?.isNight ?? false}
        temp={station?.temp ?? null}
        rh={station?.rh ?? null}
        windDir={station?.windDir ?? null}
        windDeg={station?.windDeg ?? null}
        windSpeed={station?.windSpeed ?? null}
        rain={station?.rain ?? null}
      />
    </div>
  );
}
