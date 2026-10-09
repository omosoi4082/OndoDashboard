// weatherCode(+isNight) → 아이콘 매핑 (docs/01-functional-spec.md 2장, docs/02-relay-api.md 3장).
// 필수 7종(맑음·구름 조금·구름 많음·흐림·비·비/눈·눈) + 선택 2종(맑음·구름 많음의 밤 버전).
// 디자인 가이드 미수신(05-open-questions.md #23)이라 lucide-react 아이콘을 임시로 쓴다 —
// 실제 아이콘 자료가 오면 이 매핑 테이블만 바꾸면 된다.
import {
  Cloud,
  CloudMoon,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Cloudy,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import type { WeatherCode } from '@ondo/shared';

export interface WeatherIconInfo {
  Icon: LucideIcon;
  /** 접근성/툴팁용 한국어 라벨. */
  label: string;
}

const DAY_ICONS: Record<WeatherCode, WeatherIconInfo> = {
  CLEAR: { Icon: Sun, label: '맑음' },
  PARTLY_CLOUDY: { Icon: CloudSun, label: '구름 조금' },
  MOSTLY_CLOUDY: { Icon: Cloudy, label: '구름 많음' },
  OVERCAST: { Icon: Cloud, label: '흐림' },
  RAIN: { Icon: CloudRain, label: '비' },
  RAIN_SNOW: { Icon: CloudRainWind, label: '비/눈' },
  SNOW: { Icon: CloudSnow, label: '눈' },
};

// 선택 2종: 맑음·구름 많음의 밤 버전만 따로 둔다(그 외 코드는 밤이어도 낮 아이콘 그대로).
const NIGHT_ICONS: Partial<Record<WeatherCode, WeatherIconInfo>> = {
  CLEAR: { Icon: Moon, label: '맑음(밤)' },
  MOSTLY_CLOUDY: { Icon: CloudMoon, label: '구름 많음(밤)' },
};

/** weatherCode가 null이면 아이콘 대신 '-' 표시(호출 측에서 null 체크). */
export function getWeatherIcon(code: WeatherCode | null, isNight: boolean): WeatherIconInfo | null {
  if (code === null) return null;
  if (isNight) {
    const nightIcon = NIGHT_ICONS[code];
    if (nightIcon) return nightIcon;
  }
  return DAY_ICONS[code];
}
