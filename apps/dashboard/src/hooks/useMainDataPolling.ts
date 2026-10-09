// 메인 화면 3개 영역을 각각 독립적으로 폴링한다(docs/01-functional-spec.md 2장
// "메인 데이터 갱신" — rooms / weather/kma / weather/station 각각 접속 시 1회 + 10분마다).
import { fetchMainRooms, fetchMainWeatherKma, fetchMainWeatherStation } from '../api/endpoints.js';
import { MAIN_POLL_INTERVAL_MS } from '../config/constants.js';
import { useMainStore } from '../store/mainStore.js';
import { usePolling } from './usePolling.js';

export function useMainDataPolling(): void {
  const setRooms = useMainStore((s) => s.setRooms);
  const setWeatherKma = useMainStore((s) => s.setWeatherKma);
  const setWeatherStation = useMainStore((s) => s.setWeatherStation);

  usePolling(fetchMainRooms, MAIN_POLL_INTERVAL_MS, setRooms);
  usePolling(fetchMainWeatherKma, MAIN_POLL_INTERVAL_MS, setWeatherKma);
  usePolling(fetchMainWeatherStation, MAIN_POLL_INTERVAL_MS, setWeatherStation);
}
