// 타임라인(17·24·31) — 01-functional-spec.md 4.5: 재생/일시정지/정지, 10분 단위 눈금,
// 드래그 이동, 현재 프레임 시각 표시, 재생 속도 기본 프레임당 0.5초(상수),
// 재생 중 추가 요청 없음(이미 store에 있는 frames만 읽는다). 프레임 전진/정지 판단과
// 시각 포맷은 detail/timeline.ts의 순수 함수로 분리해 테스트한다.
// 재생/일시정지/정지 세 버튼 → 원형 재생·일시정지 토글 버튼 하나 + 슬라이더로 재구성
// (2026-10-10 Figma node 374:25494~25500 "03_전문가모드_디자인_01" 재확인본 실측 —
// 예측·전문가·제어 세 모드 전부 같은 디자인, 사용자 확인). "정지" 버튼은 없앤 게 아니라
// DetailSections.tsx의 TimelineSection 제목 줄 "초기화"로 이름만 바뀌어 옮겨갔다(기능은
// 그대로 stop() — 첫 프레임으로 되돌리고 멈춤). 시간 표시(현재 "HH:mm (n/총)")·10분 단위
// 눈금 디자인은 사용자 확인: "일단 표기, 디자인 변경될 예정" — 지금은 안 건드린다.
import { useEffect, type ReactElement } from 'react';
import { Pause, Play } from 'lucide-react';
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
  const advanceTimeline = useDetailStore((s) => s.advanceTimeline);

  const frameCount = frames.length;
  const clampedIndex = Math.min(frameIndex, Math.max(frameCount - 1, 0));
  const currentFrame = frames[clampedIndex] ?? null;
  const progressPct = frameCount > 1 ? (clampedIndex / (frameCount - 1)) * 100 : 0;

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
    <div className="flex shrink-0 flex-col gap-2">
      <div className="flex items-center gap-4">
        {/* 재생·일시정지 토글 버튼(지름 38px, Figma node 374:25495 실측) */}
        <button
          type="button"
          onClick={playing ? pause : play}
          disabled={frameCount === 0}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#4d5869] text-white transition-colors hover:bg-[#5a6679] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </button>

        <div className="relative flex min-w-0 flex-1 items-center" style={{ height: 24 }}>
          {/* 트랙·진행 바·손잡이 — 높이 7px(Figma node 374:25500 실측), 드래그는 투명 네이티브
              range를 위에 겹쳐서 처리한다(접근성·키보드 조작 유지). */}
          <div className="pointer-events-none absolute inset-x-0 h-[7px] rounded-full bg-white/15" />
          <div
            className="pointer-events-none absolute left-0 h-[7px] rounded-full bg-cyan-400"
            style={{ width: `${progressPct}%` }}
          />
          <div
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full bg-white shadow"
            style={{ left: `${progressPct}%` }}
          />
          <input
            type="range"
            min={0}
            max={Math.max(frameCount - 1, 0)}
            step={1}
            value={clampedIndex}
            onChange={(e) => setTimelineFrameIndex(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>

        <span className="shrink-0 text-xs text-white/60">
          {currentFrame ? formatFrameTime(currentFrame.time) : '-'} ({Math.min(clampedIndex + 1, frameCount)}/{frameCount})
        </span>
      </div>
    </div>
  );
}
