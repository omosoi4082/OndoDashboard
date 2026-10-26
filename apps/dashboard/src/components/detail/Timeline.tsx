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
    // mr-[19px]: 이 열(재생 버튼 + 트랙 + 라벨)을 통째로 오른쪽 여백만큼 왼쪽으로 미는 값이다.
    // 처음엔 27px이었다 — 2026-10-26 사용자 지시 "재생버튼, 라인, 시간 전체를 왼쪽으로
    // 재생버튼 크기만큼 이동"에서 나온 '재생 버튼 지름 27px'이 근거였다. 같은 날 다시
    // "재생버튼, 라인, 아래 글씨들을 전체적으로 우측으로 8 이동"이라 해서 27 − 8 = 19px이
    // 됐고, 이제 '버튼 지름'이라는 유래와는 무관한 값이다(되돌릴 땐 27).
    // 트랙 폭 620·버튼↔트랙 4px은 그대로라 통째 평행 이동이고, 트랙 오른쪽 끝과 카드 안쪽
    // 가장자리 사이에 19px 빈 공간이 남는다.
    <div className="mr-[19px] flex shrink-0 flex-col">
      {/* 2026-10-26 사용자 지시 "타임라인 가로길이 20% 줄여주고 재생버튼 라인 줄어든 만큼
          붙여줘": 트랙을 기존 폭의 80%로 줄이고(크롬 실측 705 → 564px) 오른쪽 끝은 그대로 둔
          채 왼쪽에서 깎는다. 그래서 줄을 justify-end로 돌리고 트랙을 flex-1 대신 고정폭으로
          바꿨다 — 재생 버튼이 트랙 왼쪽 끝에 따라붙고 줄 왼쪽에 빈 공간이 남는다(의도된 모습).
          ★ 임의값 클래스(w-[564px])는 리터럴로 적는다 — 템플릿 문자열로 조립하면 빌드 때
          스캐너가 못 찾아 CSS가 생성되지 않는다(ExpertInputForm.tsx GRID_COLS 주석과 같은 함정).
          트랙 높이 5·점 2·손잡이 13·버튼 27px은 그대로. 눈금 점과 손잡이는 트랙 폭 기준 %라
          자동으로 따라온다(실측 확인).
          버튼↔트랙 간격은 원래 gap-4(16px)였다(2026-10-26 타임라인 30% 축소 때 "요소 내부
          간격이라 유지"로 판단했던 값이고, 당시 라벨 줄 들여쓰기 계산의 근거이기도 했다 —
          지금은 라벨이 w-[620px] self-end로 폭을 공유해 그 의존은 없다).
          트랙을 620px로 넓히면서 이 줄이 카드 안쪽 폭(748)에 꽉 차버려 gap-1(4px)로 줄였다:
            필요 폭 = 왼쪽 열 59 + 섹션 gap 10 + 버튼 27 + (버튼↔트랙 gap) + 트랙 620
                      + 오른쪽 여백 27 = 743 + gap
            gap 16 → 759(11px 초과) / 8 → 751(3px 초과) / **4 → 747(1px 여유)**
          즉 4px이 "트랙 620 + 오른쪽 27px 여백"을 지키면서 들어가는 유일한 값이다
          (2026-10-26 사용자 지시 "재생버튼을 라인쪽으로 조금 붙여줘"와도 같은 방향).
          2026-10-26 추가 지시 "라인을 10% 늘리고 오른쪽 공간은 그대로, 왼쪽으로만": 트랙·라벨
          줄을 564 → 620px(×1.1)로 넓혔다. 오른쪽 끝(mr-[27px])은 고정이라 늘어난 56px은 전부
          왼쪽으로 뻗고 재생 버튼도 그만큼 왼쪽으로 밀린다. */}
      <div className="flex items-center justify-end gap-1">
        {/* 재생·일시정지 토글 버튼(지름 27px — 2026-10-26 사용자 지시 "타임라인 재생버튼
            전체적으로 30% 줄여줘"로 38 → 27. 아래 트랙·점·손잡이도 같은 비율로 줄였다). */}
        <button
          type="button"
          onClick={playing ? pause : play}
          disabled={frameCount === 0}
          className="flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full bg-[#4d5869] text-white transition-colors hover:bg-[#5a6679] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
        </button>

        <div className="relative flex w-[620px] shrink-0 items-center" style={{ height: 24 }}>
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
          {/* 트랙(#434f62, 높이 5px — 원래 7px에서 30% 축소) */}
          <div className="pointer-events-none absolute inset-x-0 h-[5px] rounded-full bg-[#434f62]" />
          {/* 채움(진행된 구간, #5088d4) */}
          <div
            className="pointer-events-none absolute left-0 h-[5px] rounded-full bg-[#5088d4]"
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
                className="pointer-events-none absolute h-[2px] w-[2px] -translate-x-1/2 rounded-full bg-white/30"
                style={{ left: `${pct}%` }}
              />
            );
          })}
          {/* 손잡이는 드래그 중에만 표시한다(기본·재생 상태엔 없음 — 02_예측모드_디자인_02
              실측 확인, 사용자 확인). 흰 원 하나가 아니라 흰 중심 + 채움색(#5088d4)
              테두리 — 02_예측모드_디자인_04 확대 실측("드래그시에 원 모양 잘봐 흰색에
              테두리있어", 사용자 확인)이었고, 시안값은 중심 10px + 테두리 4px(바깥지름
              18px). 2026-10-26 30% 축소 지시로 바깥지름 13px·테두리 3px가 됐다. */}
          {isDragging && (
            <div
              className="pointer-events-none absolute h-[13px] w-[13px] -translate-x-1/2 rounded-full border-[3px] border-[#5088d4] bg-white shadow"
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
          **트랙과 같은 폭(564px)을 self-end로 오른쪽에 붙여** 글자 양 끝이 트랙 양 끝과
          정확히 맞는다 — 들여쓰기(pl-[184px], 그 전엔 43/54)로 맞추던 걸 2026-10-26 2단
          재배치 때 이 방식으로 바꿨다. 제목·초기화가 왼쪽 열로 빠지면서 이 묶음의 왼쪽
          기준점이 사라졌기 때문이다(DetailSections.tsx TimelineSection 주석 참고).
          글자 크기는 2026-10-26 사용자 지시로 양쪽 다 11px(왼쪽 "현재 …" 12 → 11은 10%
          축소, 오른쪽은 원래 14px에서 20% 축소 — 직전에 30%(10px)로 줄였던 걸 되올림).
          leading-4로 줄높이를 16px에 고정해 둔다 — text-xs(12/16)일 때와 줄 박스 높이가
          같아야 아래 -mt-1 보정(트랙 바닥~글자 상단 14px, 02_예측모드_디자인_04 실측)이
          그대로 맞는다. */}
      <div className="-mt-1 flex h-4 w-[620px] items-end justify-between self-end">
        {/* ⓘ 안내 아이콘은 2026-10-26 사용자 지시로 "시간 설정" 옆에서 이 "현재 …" 라벨
            오른쪽으로 옮겼다(글자↔아이콘 6px은 2026-10-11 지정값 그대로). 줄 박스 높이는
            h-4(16px)로 못 박고 18px 아이콘은 items-center로 위아래 1px씩 넘치게 둔다 —
            줄 높이를 키우면 위 -mt-1로 맞춰 둔 트랙↔라벨 간격이 틀어진다(overflow는
            보이기만 하고 레이아웃에 영향을 주지 않는다).
            정렬: 처음엔 "아래 정렬"(items-end, 상자 밑변 일치) 지시였는데 사용자 눈에
            글자가 떠 보인다고 해서 2026-10-26 "가운데 정렬이라도 해줘"로 바꿨다.
            원인은 info.png 자체의 여백이다 — 18×18 안에 원이 위 3px·아래 1px 치우쳐
            들어 있어서 상자 기준으로 맞추면 그림이 1px 내려간다(PNG는 디자인 원본이라
            고치지 않는다). 바깥 줄은 items-end 그대로 둬서 오른쪽 "… / …" 라벨의 세로
            위치는 움직이지 않는다. */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] leading-4 text-white/60">
            {elapsedLabels ? formatElapsedFrameTime(0) : firstFrame ? `현재 ${formatFrameDateTime(firstFrame.time)}` : '-'}
          </span>
          {/* top-[-1px]: info.png 안에서 원이 위 3px·아래 1px로 치우쳐 있어(알파 스캔 실측:
              18px 중 3~16행만 그림) 상자를 가운데 맞추면 그림 중심이 글자 중심보다 1.5px
              아래로 보인다. 레이아웃은 건드리지 않고 그리기 위치만 1px 올려 보정한다.
              (PNG는 디자인 원본이라 고치지 않는다 — 2026-10-26) */}
          <div className="group relative top-[-1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center">
            <img src="/assets/icons/control/info.png" alt="" width={18} height={18} />
            {/* 아이콘 옆(오른쪽)에 갭 4px로 — 2026-10-11 사용자 정정: "info호버시 나오는
                10분단위 위치는 옆이여야지 아이콘과 갭 4로 해서". 글자 11px(2026-10-26 10% 축소). */}
            <span className="pointer-events-none absolute left-full top-1/2 z-10 ml-1 -translate-y-1/2 whitespace-nowrap rounded bg-[#474748] px-2 py-0.5 text-[11px] leading-4 text-white/80 opacity-0 transition-opacity group-hover:opacity-100">
              10분 단위
            </span>
          </div>
        </div>
        <span className="text-[11px] leading-4 text-white">
          {elapsedLabels
            ? `${formatElapsedFrameTime(clampedIndex)} / ${formatElapsedFrameTime(Math.max(frameCount - 1, 0))}`
            : `${currentFrame ? formatFrameDateTime(currentFrame.time) : '-'}${lastFrame ? ` / ${formatFrameDateTime(lastFrame.time)}` : ''}`}
        </span>
      </div>
    </div>
  );
}
