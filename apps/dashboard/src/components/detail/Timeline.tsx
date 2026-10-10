// 타임라인(17·24·31) — 01-functional-spec.md 4.5: 재생/일시정지/정지, 10분 단위 눈금,
// 드래그 이동, 현재 프레임 시각 표시, 재생 속도 기본 프레임당 0.5초(상수),
// 재생 중 추가 요청 없음(이미 store에 있는 frames만 읽는다). 프레임 전진/정지 판단과
// 시각 포맷은 detail/timeline.ts의 순수 함수로 분리해 테스트한다.
// 재생/일시정지/정지 세 버튼 → 원형 재생·일시정지 토글 버튼 하나 + 슬라이더로 재구성
// (예측·전문가·제어 세 모드 전부 같은 디자인, 사용자 확인). "정지" 버튼은 없앤 게 아니라
// DetailSections.tsx의 TimelineSection 제목 줄 "초기화"로 이름만 바뀌어 옮겨갔다(기능은
// 그대로 stop() — 첫 프레임으로 되돌리고 멈춤).
// 색상·점 크기·말풍선·시간 표시 위치는 docs/design/UI/02_예측모드_디자인_04.png(2026-10-10
// 전달분) 픽셀 실측값 그대로다 — 트랙 #434f62, 채움 #5088d4, 1시간 점 3×3px #7b8391,
// 말풍선 배경 #363f4d, 좌우 "00:00"/"현재시각 / 24:00" 표기. "현재시각"이 실제 시각인지
// 시작 기준 경과 시간인지는 05-open-questions.md #38 미정이라 기존처럼 프레임의 실제 시각
// (formatFrameTime)을 그대로 쓴다.
import { useEffect, useState, type ReactElement } from 'react';
import { Pause, Play } from 'lucide-react';
import type { DetailFrame } from '@ondo/shared';
import { useDetailStore } from '../../store/detailStore.js';
import { TIMELINE_FRAME_DURATION_MS } from '../../config/constants.js';
import { formatFrameTime, hourTickIndices } from '../../detail/timeline.js';

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
  const [isDragging, setIsDragging] = useState(false);

  const frameCount = frames.length;
  const clampedIndex = Math.min(frameIndex, Math.max(frameCount - 1, 0));
  const currentFrame = frames[clampedIndex] ?? null;
  const progressPct = frameCount > 1 ? (clampedIndex / (frameCount - 1)) * 100 : 0;
  // 맨 처음·맨 끝엔 점을 안 찍는다(2026-10-10 사용자 확인 — "시간 점이 22개만 표시,
  // 처음과 끝은 시안에 없음").
  const hourTicks = hourTickIndices(frameCount).filter((idx) => idx !== 0 && idx !== frameCount - 1);

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
    <div className="flex shrink-0 flex-col gap-1">
      <div className="flex items-center gap-4">
        {/* 재생·일시정지 토글 버튼(지름 38px) */}
        <button
          type="button"
          onClick={playing ? pause : play}
          disabled={frameCount === 0}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#4d5869] text-white transition-colors hover:bg-[#5a6679] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </button>

        <div className="relative flex min-w-0 flex-1 items-center" style={{ height: 24 }}>
          {/* 드래그 중 말풍선 시간 표시 */}
          {isDragging && currentFrame && (
            <div
              className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#363f4d] px-2 py-1 text-[11px] text-white shadow-lg"
              style={{ left: `${progressPct}%` }}
            >
              {formatFrameTime(currentFrame.time)}
              <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-[#363f4d]" />
            </div>
          )}
          {/* 트랙(#434f62, 높이 7px) */}
          <div className="pointer-events-none absolute inset-x-0 h-[7px] rounded-full bg-[#434f62]" />
          {/* 1시간 단위 점(3×3px, #7b8391) — 채움 바 아래에 둬서 지난 구간은 채움색에 덮인다. */}
          {hourTicks.map((idx) => {
            const pct = frameCount > 1 ? (idx / (frameCount - 1)) * 100 : 0;
            return (
              <div
                key={idx}
                className="pointer-events-none absolute h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-[#7b8391]"
                style={{ left: `${pct}%` }}
              />
            );
          })}
          {/* 채움(진행된 구간, #5088d4) */}
          <div
            className="pointer-events-none absolute left-0 h-[7px] rounded-full bg-[#5088d4]"
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
            onPointerDown={() => setIsDragging(true)}
            onPointerUp={() => setIsDragging(false)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
      </div>

      {/* 좌: "00:00" 고정, 우: 현재 시각 / 24:00 — 재생·일시정지 버튼 폭(38+16gap)만큼 들여써서
          바 양 끝과 맞춘다. */}
      <div className="flex justify-between pl-[54px] text-xs text-white/60">
        <span>00:00</span>
        <span>{currentFrame ? formatFrameTime(currentFrame.time) : '-'} / 24:00</span>
      </div>
    </div>
  );
}
