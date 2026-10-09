// 상세 패널(6) "현재" 탭 데이터 폴링 — docs/02-relay-api.md 6장, docs/04-tasks.md M4
// 완료 조건("상세 진입 시 메인 API들과 동시 호출, 현재 모드 유지 중 10분 주기"). geometry
// 부트스트랩(useDetailGeometryBootstrap)과 함께 앱 마운트 시점에 걸려 있으면 자연히
// 동시에 시작된다 — 서로 독립적으로 자기 주기를 돈다.
import { fetchDetailCurrent } from '../api/endpoints.js';
import { CURRENT_DETAIL_POLL_INTERVAL_MS } from '../config/constants.js';
import { useDetailStore } from '../store/detailStore.js';
import { usePolling } from './usePolling.js';

export function useCurrentDetailPolling(): void {
  const setCurrent = useDetailStore((s) => s.setCurrent);
  usePolling(fetchDetailCurrent, CURRENT_DETAIL_POLL_INTERVAL_MS, setCurrent);
}
