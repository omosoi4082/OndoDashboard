// 상세 패널(6) geometry 1회 부트스트랩. usePolling(반복 폴링 전용)과 달리 상세 진입(=
// 이 앱은 상세가 항상 열려 있으므로 마운트) 시 단 한 번만 요청하고 다시 요청하지 않는다
// (docs/02-relay-api.md 5장). 이후 상세 응답(GET /api/detail/current 등)의 geometryId가
// 보관 중인 값과 달라질 때 재요청하는 트리거는 M4에서 detail/geometryCompare.ts의
// shouldRefetchGeometry()로 연결한다 — 지금은 비교 로직만 준비돼 있다.
import { useEffect } from 'react';
import { fetchDetailGeometry } from '../api/endpoints.js';
import { useDetailStore } from '../store/detailStore.js';

export function useDetailGeometryBootstrap(): void {
  const setGeometry = useDetailStore((s) => s.setGeometry);

  useEffect(() => {
    let cancelled = false;
    fetchDetailGeometry()
      .then((geometry) => {
        if (!cancelled) setGeometry(geometry);
      })
      .catch((err: unknown) => {
        // M3 범위: 끊김 UI는 아직 없다(geometry는 상세 패널 전체의 전제 조건이라
        // 실패 시 패널이 로딩 상태로 남는다) — 콘솔에만 남긴다.
        console.error('[detail] GET /api/detail/geometry 요청 실패', err);
      });
    return () => {
      cancelled = true;
    };
  }, [setGeometry]);
}
