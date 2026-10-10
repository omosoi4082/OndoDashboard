// 제어 모드 환기량 비교 그래프(34, 32번 3D 영역 오버레이, C안) — 01-functional-spec.md 4.4,
// docs/design/UI/그래프.png(2026-10-11 전달, 04_제어모드_디자인_01_gh 참고 — 카드 위치가
// 3D 영역 우측 하단으로 바뀌었다). 요약 카드(절감률·팬 절감률·최고 온도) + 꺾은선 그래프
// (기준=점선, 최적화=실선, 재생 위치=세로선). 좌표 계산은 detail/controlChart.ts의 순수
// 함수로 분리했고(테스트됨), 이 컴포넌트는 SVG로 그 좌표를 그리기만 한다 — 벡터 꺾은선
// 그래프라 Detail2DSection의 canvas 히트맵(래스터 이미지)과는 쓰임이 달라 SVG를 택했다
// (개발자 결정, docs/05-open-questions.md #33).
import type { ReactElement } from 'react';
import type { ControlBlock, DetailFrame } from '@ondo/shared';
import { buildControlChartTicks, buildControlLinePath, controlPlaybackX } from '../../detail/controlChart.js';
import { CONTROL_CHART_Y_MAX } from '../../config/constants.js';

interface ControlSummaryCardProps {
  frames: readonly DetailFrame[];
  control: ControlBlock;
  frameIndex: number;
}

// 350×172, 그림자 있음·테두리 없음·불투명도 70%, 가로 기준선 간격 25px, 글씨 크기
// (절감률 등 라벨 13px·퍼센트/값 숫자 16px·그래프 축 숫자 9px) — 2026-10-11 사용자 실측
// 지시.
const CARD_WIDTH = 350;
const CARD_HEIGHT = 172;
const CHART_WIDTH = 278;
const CHART_HEIGHT = 50;
const CHART_PADDING_LEFT = 32;
const CHART_PADDING_BOTTOM = 18;
const INNER_WIDTH = CHART_WIDTH;
const INNER_HEIGHT = CHART_HEIGHT;

/** 항목 제목 앞 민트색 세로 바(│) — 그래프.png 실측 #2af5c0, 3×12px. */
function SummaryTick(): ReactElement {
  return <span className="h-3 w-[3px] shrink-0 rounded-sm bg-[#2af5c0]" />;
}

export function ControlSummaryCard({ frames, control, frameIndex }: ControlSummaryCardProps): ReactElement {
  const baselinePath = buildControlLinePath(control.baselineFanPct, frames, INNER_WIDTH, INNER_HEIGHT);
  const optimizedPath = buildControlLinePath(control.optimizedFanPct, frames, INNER_WIDTH, INNER_HEIGHT);
  const ticks = buildControlChartTicks(frames, INNER_WIDTH);
  const playbackX = controlPlaybackX(frames, frameIndex, INNER_WIDTH);

  return (
    <div
      className="pointer-events-auto rounded-lg bg-[#141414]/70 p-5 backdrop-blur-sm"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        // "그래프 백그라운드참고.png"(2026-10-11 전달) Figma Effects 패널 실측 — 3겹 drop
        // shadow(X0/Y6/blur12/48%, X0/Y12/blur32/32%, X0/Y18/blur56/20%)를 그대로 옮긴다.
        boxShadow:
          '0 6px 12px rgba(0,0,0,0.48), 0 12px 32px rgba(0,0,0,0.32), 0 18px 56px rgba(0,0,0,0.2)',
      }}
    >
      {/* 라벨에 단위를 괄호로 붙이고(팬 절감률 (kWh), 최고 온도 (℃)), 값에선 단위를 뺀다
          — 그래프.png 실측(2026-10-11 전달). */}
      <div className="flex justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-[13px] text-white/60">
            <SummaryTick />
            절감률
          </div>
          <div className="mt-1 text-base font-bold text-white">{control.savingPct.toFixed(0)}%</div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-white/60">
            <SummaryTick />
            팬 절감률 (kWh)
          </div>
          <div className="mt-1 whitespace-nowrap text-base font-bold text-white">
            {control.energyKwh.baseline.toFixed(2)} → {control.energyKwh.optimized.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-white/60">
            <SummaryTick />
            최고 온도 (℃)
          </div>
          <div className="mt-1 whitespace-nowrap text-base font-bold text-white">
            {control.tMax.baseline.toFixed(1)} → {control.tMax.optimized.toFixed(1)}
          </div>
        </div>
      </div>

      <svg
        width={CHART_WIDTH + CHART_PADDING_LEFT}
        height={CHART_HEIGHT + CHART_PADDING_BOTTOM}
        className="mt-4 overflow-visible"
        role="img"
        aria-label="기준·최적화 환기량 비교 그래프"
      >
        <g transform={`translate(${CHART_PADDING_LEFT},0)`}>
          {/* y축 0·50·100% 기준선(그래프.png 실측: "%" 표기 포함) */}
          {[0, 50, 100].map((v) => {
            const y = CHART_HEIGHT - (v / CONTROL_CHART_Y_MAX) * CHART_HEIGHT;
            return (
              <g key={v}>
                <line x1={0} y1={y} x2={CHART_WIDTH} y2={y} stroke="#ffffff33" strokeWidth={1} />
                <text x={-6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#ffffff80">
                  {v}%
                </text>
              </g>
            );
          })}

          {/* x축 6시간 간격 눈금 라벨 */}
          {ticks.map((tick) => (
            <text
              key={tick.offsetMinFromStart}
              x={tick.x}
              y={CHART_HEIGHT + 12}
              textAnchor={tick.x === 0 ? 'start' : tick.x >= CHART_WIDTH ? 'end' : 'middle'}
              fontSize={9}
              fill="#ffffff80"
            >
              {tick.label}
            </text>
          ))}

          {/* 기준 환기량(점선) */}
          <path d={baselinePath} fill="none" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 3" />
          {/* 최적화 환기량(실선) */}
          <path d={optimizedPath} fill="none" stroke="#34d399" strokeWidth={2} />

          {/* 재생 위치 세로선 — 타임라인과 함께 이동 */}
          <line x1={playbackX} y1={0} x2={playbackX} y2={CHART_HEIGHT} stroke="#38bdf8" strokeWidth={1.5} />
        </g>
      </svg>
    </div>
  );
}
