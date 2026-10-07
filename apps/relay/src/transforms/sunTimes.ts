// isNight 판정: FARM_LAT/LON 기준 일출·일몰(suncalc). docs/03-upstream-apis.md 3장.
import SunCalc from 'suncalc';

/** date는 실제 UTC 순간(now)이어야 한다 — kstWallClock() 트릭 Date를 넣지 않는다. */
export function isNightAt(date: Date, lat: number, lon: number): boolean {
  const times = SunCalc.getTimes(date, lat, lon);
  return date.getTime() < times.sunrise.getTime() || date.getTime() >= times.sunset.getTime();
}
