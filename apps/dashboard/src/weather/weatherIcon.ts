// weatherCode(+isNight) → 아이콘 매핑 (docs/01-functional-spec.md 2장, docs/02-relay-api.md 3장).
// 필수 7종(맑음·구름 조금·구름 많음·흐림·비·비/눈·눈) + 선택 2종(맑음·구름 많음의 밤 버전).
// 디자인 아이콘(docs/design/icon → public/assets/icons/weather, 영문 파일명 복사본)을 쓴다.
import type { WeatherCode } from '@ondo/shared';

export interface WeatherIconInfo {
  /** 아이콘 이미지 경로(Vite 정적 서빙). */
  src: string;
  /** 접근성/툴팁용 한국어 라벨. */
  label: string;
}

const ICON_DIR = '/assets/icons/weather';

const DAY_ICONS: Record<WeatherCode, WeatherIconInfo> = {
  CLEAR: { src: `${ICON_DIR}/clear.png`, label: '맑음' },
  PARTLY_CLOUDY: { src: `${ICON_DIR}/partly-cloudy.png`, label: '구름 조금' },
  MOSTLY_CLOUDY: { src: `${ICON_DIR}/mostly-cloudy.png`, label: '구름 많음' },
  OVERCAST: { src: `${ICON_DIR}/overcast.png`, label: '흐림' },
  RAIN: { src: `${ICON_DIR}/rain.png`, label: '비' },
  RAIN_SNOW: { src: `${ICON_DIR}/rain-snow.png`, label: '비/눈' },
  SNOW: { src: `${ICON_DIR}/snow.png`, label: '눈' },
};

// 선택 2종: 맑음·구름 많음의 밤 버전만 따로 둔다(그 외 코드는 밤이어도 낮 아이콘 그대로).
const NIGHT_ICONS: Partial<Record<WeatherCode, WeatherIconInfo>> = {
  CLEAR: { src: `${ICON_DIR}/clear-night.png`, label: '맑음(밤)' },
  MOSTLY_CLOUDY: { src: `${ICON_DIR}/mostly-cloudy-night.png`, label: '구름 많음(밤)' },
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
