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
// 말풍선 배경 #363f4d.
// 양 끝 라벨은 기본적으로 frames의 실제 시각(날짜 포함)을 쓴다 — 2026-10-13 온도 측 B-7 확정
// ("슬라이더 양 끝을 ... frames[i].time의 실제 시각(날짜 포함)으로 표시하고, 프레임 0에 '현재'
// 표시를 부탁드립니다"). 05-open-questions.md #37·#38.
// 예외로 `elapsedLabels`를 켜면 "00:00"~"24:00" 경과 시간으로 찍는다 — **전문가 모드 전용**이다
// (2026-10-17 시안 05). 전문가 모드는 사용자가 0시~23시 표에 직접 넣은 가상 시나리오라 실제
// 날짜·시각에 매이지 않고, 입력 표의 시간 축과 결과 타임라인의 축을 같게 맞추는 편이 읽기 쉽다.
// B-7은 예측 모드 타임라인(#37·#38)에 대한 요청이었으므로 예측·제어는 그대로 실제 시각을 쓴다.
import { useEffect, useState, type ReactElement } from 'react';
import { Pause, Play } from 'lucide-react';
import type { DetailFrame } from '@ondo/shared';
import { useDetailStore } from '../../store/detailStore.js';
import { TIMELINE_FRAME_DURATION_MS } from '../../config/constants.js';
import { formatElapsedFrameTime, formatFrameDateTime, formatFrameTime, hourTickIndices } from '../../detail/timeline.js';

interface TimelineProps {
  frames: readonly DetailFrame[];
  /** 양 끝·현재 라벨을 실제 시각 대신 "00:00"~"24:00" 경과 시간으로(전문가 모드 전용). */
  elapsedLabels?: boolean;
}

export function Timeline({ frames, elapsedLabels = false }: TimelineProps): ReactElement {
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
  const firstFrame = frames[0] ?? null;
  const lastFrame = frames[frameCount - 1] ?? null;
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
    <div className="flex shrink-0 flex-col">
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
              className="pointer-events-none absolute bottom-full mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#363f4d] px-2 py-1 text-sm text-white shadow-lg"
              style={{ left: `${progressPct}%` }}
            >
              {formatFrameTime(currentFrame.time)}
              <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-[#363f4d]" />
            </div>
          )}
          {/* 트랙(#434f62, 높이 7px) */}
          <div className="pointer-events-none absolute inset-x-0 h-[7px] rounded-full bg-[#434f62]" />
          {/* 채움(진행된 구간, #5088d4) */}
          <div
            className="pointer-events-none absolute left-0 h-[7px] rounded-full bg-[#5088d4]"
            style={{ width: `${progressPct}%` }}
          />
          {/* 1시간 단위 점 — 흰색 30% 불투명도, 채움 위에 그려서 지난 구간에서도 옅게
              비친다(트랙 위 rgb(123,131,145), 채움 위 rgb(132,171,225) 실측 둘 다 흰색
              30% 블렌드와 일치). */}
          {hourTicks.map((idx) => {
            const pct = frameCount > 1 ? (idx / (frameCount - 1)) * 100 : 0;
            return (
              <div
                key={idx}
                className="pointer-events-none absolute h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-white/30"
                style={{ left: `${pct}%` }}
              />
            );
          })}
          {/* 손잡이는 드래그 중에만 표시한다(기본·재생 상태엔 없음 — 02_예측모드_디자인_02
              실측 확인, 사용자 확인). 흰 원 하나가 아니라 흰 중심(10px) + 채움색(#5088d4)
              테두리(4px, 바깥지름 18px) — 02_예측모드_디자인_04 확대 실측("드래그시에 원
              모양 잘봐 흰색에 테두리있어", 사용자 확인). */}
          {isDragging && (
            <div
              className="pointer-events-none absolute h-[18px] w-[18px] -translate-x-1/2 rounded-full border-[4px] border-[#5088d4] bg-white shadow"
              style={{ left: `${progressPct}%` }}
            />
          )}
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

      {/* 양 끝 라벨 — 2026-10-13 온도 측 B-7에 따라 경과 시간("00:00"~"24:00") 대신
          frames의 실제 시각(날짜 포함)을 쓴다. 왼쪽은 프레임 0(= 마지막 실측 시각)이라
          '현재' 표시를 같이 붙이고, 오른쪽은 마지막 프레임 시각과 재생 위치를 보여준다.
          재생·일시정지 버튼 폭(38+16gap)만큼 들여써서 바 양 끝과 맞춘다. 트랙과의 간격은
          -mt-1로 당겨 02_예측모드_디자인_04 실측(트랙 바닥~글자 상단 14px)에 맞춘다. */}
      <div className="-mt-1 flex justify-between pl-[54px]">
        <span className="text-xs text-white/60">
          {elapsedLabels ? formatElapsedFrameTime(0) : firstFrame ? `현재 ${formatFrameDateTime(firstFrame.time)}` : '-'}
        </span>
        <span className="text-sm text-white">
          {elapsedLabels
            ? `${formatElapsedFrameTime(clampedIndex)} / ${formatElapsedFrameTime(Math.max(frameCount - 1, 0))}`
            : `${currentFrame ? formatFrameDateTime(currentFrame.time) : '-'}${lastFrame ? ` / ${formatFrameDateTime(lastFrame.time)}` : ''}`}
        </span>
      </div>
    </div>
  );
}
