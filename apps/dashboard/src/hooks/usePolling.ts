// 서버 데이터 폴링은 이 훅 하나로 통일한다(CLAUDE.md 규칙).
// 접속 시 즉시 1회 + intervalMs 주기로 재호출. setInterval은 탭이 비활성화돼도
// (드물게 브라우저가 느리게 할 수는 있어도) 취소되지 않으므로 별도 처리가 필요 없다.
// 언마운트 시 타이머 정리 + 늦게 끝난 요청 결과 무시(cancelled 플래그).
import { useEffect, useRef } from 'react';

export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, onResult: (result: T) => void): void {
  const fetcherRef = useRef(fetcher);
  const onResultRef = useRef(onResult);

  // ref 갱신은 렌더 중이 아니라 effect에서 한다(react(refs) 린트 규칙) — 다음 tick의
  // setInterval 콜백이 최신 fetcher/onResult를 읽으면 되므로 타이밍상 문제는 없다.
  useEffect(() => {
    fetcherRef.current = fetcher;
    onResultRef.current = onResult;
  }, [fetcher, onResult]);

  useEffect(() => {
    let cancelled = false;

    const run = (): void => {
      fetcherRef.current()
        .then((result) => {
          if (!cancelled) onResultRef.current(result);
        })
        .catch(() => {
          // fetcher(fetchApi 기반)는 자체적으로 에러를 ApiError로 감싸 반환하므로 여기까지
          // reject가 올라오는 경우는 fetcher 구현 오류뿐이다 — 화면을 깨뜨리지 않게만 막는다.
        });
    };

    run();
    const timer = setInterval(run, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // fetcher/onResult는 ref로 최신값을 참조하므로 의존성에서 뺀다(매 렌더 재구독 방지).
  }, [intervalMs]);
}
