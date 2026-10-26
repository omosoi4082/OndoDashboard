// 예측 모드 등치면(scene/IsosurfaceVolume.tsx) — Web Worker(scene/isosurfaceWorker.ts)에
// 프레임 전체(최대 145개)의 grid 2배 삼선형 보간을 한 번에 맡기고, 결과를 프레임 인덱스로
// 바로 꺼낼 수 있게 캐시해 둔다(docs/04-tasks.md M5 "Worker에서 프레임별 미리 계산·캐시").
// frames 배열 참조가 바뀌지 않는 한(= 같은 forecast 응답을 보는 동안) 다시 계산하지 않는다.
import { useEffect, useRef, useState } from 'react';
import type { DetailFrame, Geometry } from '@ondo/shared';
import type { IsosurfaceWorkerRequest, IsosurfaceWorkerResponse } from '../scene/isosurfaceWorker.js';

export interface IsosurfaceFrameCache {
  temp: Float32Array;
  rh: Float32Array;
  size: [number, number, number];
}

export interface IsosurfaceCache {
  getFrame: (index: number) => IsosurfaceFrameCache | null;
  ready: boolean;
}

export function useIsosurfaceCache(
  geometry: Geometry | null,
  frames: readonly DetailFrame[] | null,
): IsosurfaceCache {
  const [cache, setCache] = useState<IsosurfaceFrameCache[] | null>(null);
  // frames는 forecast 응답 하나당 한 번만 만들어지는 배열(store.setForecast)이라 참조
  // 동일성으로 "이미 이 응답을 캐시했는지"를 판단한다 — 같은 배열로 effect가 다시 돌아도
  // Worker를 재실행하지 않는다.
  const sourceRef = useRef<readonly DetailFrame[] | null>(null);

  useEffect(() => {
    if (!geometry || !frames || frames.length === 0) {
      return;
    }
    if (sourceRef.current === frames) return;
    sourceRef.current = frames;
    setCache(null);

    const worker = new Worker(new URL('../scene/isosurfaceWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<IsosurfaceWorkerResponse>) => {
      const { size, temp, rh } = event.data;
      const built: IsosurfaceFrameCache[] = temp.map((t, i) => ({
        temp: t,
        rh: rh[i] ?? new Float32Array(0),
        size,
      }));
      setCache(built);
      worker.terminate();
    };

    const request: IsosurfaceWorkerRequest = {
      grid: geometry.grid,
      tempFrames: frames.map((f) => f.grid.temp),
      rhFrames: frames.map((f) => f.grid.rh),
    };
    worker.postMessage(request);

    return () => {
      worker.terminate();
      // ★ 가드 ref를 반드시 되돌린다. StrictMode(개발 모드의 마운트→언마운트→재마운트)는
      //   효과를 두 번 돌리는데, 1회차가 ref를 채우고 정리에서 Worker를 죽인 뒤 2회차가
      //   `sourceRef.current === frames`로 그냥 return 해 버리면 Worker가 영영 안 돌아
      //   cache가 null로 남는다 — 오류도 안 나서 "등치면이 조용히 사라진다"로만 보인다
      //   (2026-10-27 사용자: "현재모드 갔다가 다시 예측모드 가면 안보여").
      //   모드 전환으로 ForecastDetailView가 언마운트·재마운트될 때마다 재현된다.
      //   같은 함정을 scene/OverviewScene.tsx 앞벽 페이드에서도 겪었다(2026-10-17).
      sourceRef.current = null;
    };
  }, [geometry, frames]);

  return {
    getFrame: (index) => cache?.[index] ?? null,
    ready: cache !== null,
  };
}
