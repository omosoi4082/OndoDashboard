// 연산 서버 요청 직렬화(2026-10-30 온도 측 요청). 연산 서버는 한 번에 1건만 계산하고,
// 계산 중에 들어온 요청은 바로 503 BUSY로 돌려보낸다(2026-10-13 D-4). 화면이 여러 개
// 열려 있으면 중계 서버가 동시에 두 건을 보내 둘째가 BUSY를 받으므로, 중계 서버에서
// 한 건씩만 내보낸다.
//
// - requestCurrent·requestForecast만 줄을 세운다. ping(GET /v1/health)은 진단용이라
//   계산 중에도 바로 답해야 해서 그대로 위임한다(check.bat이 이것만 쓴다).
// - 앞 요청이 실패해도 뒤 요청은 그대로 보낸다.
// - 재시도(clients/computeRetry.ts)는 이 데코레이터 **바깥**에 씌운다. BUSY 대기 중에
//   줄을 잡고 있으면 다른 화면이 그만큼 더 기다리기 때문이다(computeClientFactory.ts).
import type { ComputeClient, ComputeResult } from './computeClient.js';

const ignore = (): void => undefined;

export function withComputeQueue(client: ComputeClient): ComputeClient {
  // 직전 요청이 끝나면 resolve되는 약속. 여기에 이어 붙여 한 건씩 돌게 한다.
  let tail: Promise<void> = Promise.resolve();
  let pending = 0;

  const enqueue = (label: string, run: () => Promise<ComputeResult>): Promise<ComputeResult> => {
    pending += 1;
    if (pending > 1) {
      console.warn(`[compute] ${label} 요청 대기 ${pending - 1}건 — 연산 서버는 한 번에 1건만 계산한다`);
    }
    const started = tail.then(run, run);
    tail = started.then(ignore, ignore);
    return started.finally(() => {
      pending -= 1;
    });
  };

  return {
    ping: () => client.ping(),
    requestCurrent: (inputs) => enqueue('현재', () => client.requestCurrent(inputs)),
    requestForecast: (inputs, extra) => enqueue('예측', () => client.requestForecast(inputs, extra)),
  };
}
