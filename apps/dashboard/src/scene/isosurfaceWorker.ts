// 예측 모드 등치면(IsosurfaceVolume.tsx) — "grid 2배 삼선형 보간"을 프레임별로 미리
// 계산해 메인 스레드 밖(Web Worker)에서 끝내 둔다(docs/04-tasks.md M5: "프레임별 Web
// Worker에서 미리 계산·캐시"). 재생 중(60fps 목표)에는 이 계산이 한 번도 다시 돌지 않고,
// hooks/useIsosurfaceCache.ts가 모아 둔 결과만 읽는다.
//
// Vite는 `new Worker(new URL('./isosurfaceWorker.ts', import.meta.url), { type: 'module' })`
// 패턴을 별도 플러그인 없이 지원한다(이 파일을 쓰는 쪽은 hooks/useIsosurfaceCache.ts).
//
// tsconfig.app.json의 lib가 ["ES2023","DOM"]이라 "webworker" lib(DedicatedWorkerGlobalScope)
// 타입을 쓰면 DOM lib의 전역 선언과 충돌한다 — globalThis를 이 파일 전용의 좁은 인터페이스로
// 캐스팅해서 self/postMessage의 전역 타입과 부딪히지 않게 한다.
import type { GridDef } from '@ondo/shared';
import { upsampleGrid2xTrilinear, upsampledGridSize } from '../detail/gridUpsample.js';

export interface IsosurfaceWorkerRequest {
  grid: GridDef;
  tempFrames: number[][];
  rhFrames: number[][];
}

export interface IsosurfaceWorkerResponse {
  size: [number, number, number];
  temp: Float32Array[];
  rh: Float32Array[];
}

interface WorkerLikeScope {
  onmessage: ((event: MessageEvent<IsosurfaceWorkerRequest>) => void) | null;
  postMessage: (message: IsosurfaceWorkerResponse, transfer: Transferable[]) => void;
}

const scope = globalThis as unknown as WorkerLikeScope;

scope.onmessage = (event) => {
  const { grid, tempFrames, rhFrames } = event.data;
  const size = upsampledGridSize(grid.size);
  const temp = tempFrames.map((values) => upsampleGrid2xTrilinear(values, grid).values);
  const rh = rhFrames.map((values) => upsampleGrid2xTrilinear(values, grid).values);

  const response: IsosurfaceWorkerResponse = { size, temp, rh };
  const transfer: Transferable[] = [...temp.map((t) => t.buffer), ...rh.map((t) => t.buffer)];
  scope.postMessage(response, transfer);
};
