// 타임라인(17·24·31) — 01-functional-spec.md 4.5: 재생/일시정지/정지, 10분 단위 눈금,
// 드래그 이동, 현재 프레임 시각 표시, 재생 속도 기본 프레임당 0.5초(상수),
// 재생 중 추가 요청 없음(이미 store에 있는 frames만 읽는다). 프레임 전진/정지 판단과
// 시각 포맷은 detail/timeline.ts의 순수 함수로 분리해 테스트한다.
import { useEffect, type ReactElement } from 'react';
import type { DetailFrame } from '@ondo/shared';
import { useDetailStore } from '../../store/detailStore.js';
import { TIMELINE_FRAME_DURATION_MS } from '../../config/constants.js';
import { formatFrameTime } from '../../detail/timeline.js';

interface TimelineProps {
  frames: readonly DetailFrame[];
}

export function Timeline({ frames }: TimelineProps): ReactElement {
  const frameIndex = useDetailStore((s) => s.timelineFrameIndex);
  const playing = useDetailStore((s) => s.timelinePlaying);
  const setTimelineFrameIndex = useDetailStore((s) => s.setTimelineFrameIndex);
  const play = useDetailStore((s) => s.play);
  const pause = useDetailStore((s) => s.pause);
  const stop = useDetailStore((s) => s.stop);
  const advanceTimeline = useDetailStore((s) => s.advanceTimeline);

  const frameCount = frames.length;
  const currentFrame = frames[frameIndex] ?? frames[0] ?? null;

  // 재생 중엔 TIMELINE_FRAME_DURATION_MS마다 프레임을 1개 전진한다(추가 API 요청 없음 —
  // 이미 받은 frames 배열 인덱스만 바꾼다). 마지막 프레임 도달 시 advanceTimeline 내부에서
  // 자동으로 정지한다(detail/timeline.ts의 advanceTimelineFrame).
  useEffect(() => {
    if (!playing || frameCount === 0) return;
    const timer = setInterval(() => {
      advanceTimeline(frameCount);
    }, TIMELINE_FRAME_DURATION_MS);
    return () => clearInterval(timer);
  }, [playing, frameCount, advanceTimeline]);

  return (
    <div className="flex shrink-0 flex-col gap-1.5 rounded-lg border border-ondo-border bg-ondo-bg p-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={play}
          disabled={playing || frameCount === 0}
          className="rounded bg-white/5 px-2 py-1 text-xs text-white/70 hover:text-white disabled:opacity-40"
        >
          재생
        </button>
        <button
          type="button"
          onClick={pause}
          disabled={!playing}
          className="rounded bg-white/5 px-2 py-1 text-xs text-white/70 hover:text-white disabled:opacity-40"
        >
          일시정지
        </button>
        <button
          type="button"
          onClick={stop}
          className="rounded bg-white/5 px-2 py-1 text-xs text-white/70 hover:text-white"
        >
          정지
        </button>
        <span className="ml-auto text-xs text-white/60">
          {currentFrame ? formatFrameTime(currentFrame.time) : '-'} ({Math.min(frameIndex + 1, frameCount)}/{frameCount})
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(frameCount - 1, 0)}
        step={1}
        value={Math.min(frameIndex, Math.max(frameCount - 1, 0))}
        onChange={(e) => setTimelineFrameIndex(Number(e.target.value))}
        className="w-full accent-cyan-400"
      />
    </div>
  );
}
