// 예측 탭(14~19) — docs/01-functional-spec.md 4.2 "탭 선택 시 GET /api/detail/forecast 1회".
// M4 현재 모드(usePolling, 10분 주기)와 달리 "탭을 처음 선택했을 때 1회"만 호출하고,
// 이미 응답(성공이든 실패든)을 받았으면 다시 선택해도 재요청하지 않는다 — 그래서 usePolling을
// 쓰지 않고 별도 훅으로 둔다. 상세 패널이 항상 떠 있는 이 앱 구조상 App.tsx에 다른 상세
// 훅(useCurrentDetailPolling)과 함께 마운트해 둔다.
import { useEffect, useRef } from 'react';
import { fetchDetailForecast } from '../api/endpoints.js';
import { useDetailStore } from '../store/detailStore.js';

export function useForecastDetailOnDemand(): void {
  const mode = useDetailStore((s) => s.mode);
  const forecast = useDetailStore((s) => s.forecast);
  const setForecast = useDetailStore((s) => s.setForecast);
  // forecast가 null→응답으로 바뀌는 사이(요청 중) 모드를 왔다갔다 해도 중복 요청하지
  // 않도록 별도 ref로 "이미 요청을 보냈는지"를 추적한다(forecast는 응답이 올 때까지
  // null이라 그것만으로는 중복 요청을 막을 수 없다).
  const requestedRef = useRef(false);

  useEffect(() => {
    if (mode !== 'forecast' || forecast !== null || requestedRef.current) return;
    requestedRef.current = true;
    let cancelled = false;

    fetchDetailForecast().then((res) => {
      if (!cancelled) setForecast(res);
    });

    return () => {
      cancelled = true;
    };
  }, [mode, forecast, setForecast]);
}
