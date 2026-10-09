// 제어 모드(27~34) 환기량 비교 그래프(34, C안) 순수 로직 — 01-functional-spec.md 4.4,
// docs/design/control-c-summary-card.png. 좌표 계산(꺾은선 SVG path, 6시간 간격 x축 눈금,
// 재생 위치 세로선 x좌표)을 컴포넌트(ControlSummaryCard.tsx)에서 분리해 테스트한다
// (CLAUDE.md 코드 규칙). frames[i].time(10분 간격 145프레임, offsetMin 0~1440)을 시간축으로
// 공유하고, baselineFanPct·optimizedFanPct는 frames와 같은 순서·길이(ControlBlock, 0~100%).
import type { DetailFrame } from '@ondo/shared';
import { formatFrameTime } from './timeline.js';
import { CONTROL_CHART_TICK_STEP_MIN, CONTROL_CHART_Y_MAX } from '../config/constants.js';

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}

/** frames[0]~frames[last]의 offsetMin 폭(분). 길이가 0·1이면 0을 피하려고 최소 1을 돌려준다. */
function totalOffsetSpanMin(frames: readonly DetailFrame[]): number {
  if (frames.length === 0) return 1;
  const span = frames[frames.length - 1].offsetMin - frames[0].offsetMin;
  return span > 0 ? span : 1;
}

/** offsetMin(frames[0] 기준 상대값)을 그래프 폭(px) 안의 x좌표로 변환. */
export function controlChartX(frames: readonly DetailFrame[], offsetMinFromStart: number, width: number): number {
  const span = totalOffsetSpanMin(frames);
  return clamp01(offsetMinFromStart / span) * width;
}

/** 프레임 인덱스를 그래프 폭(px) 안의 x좌표로 변환 — 재생 위치 세로선에 쓴다. */
export function controlPlaybackX(frames: readonly DetailFrame[], frameIndex: number, width: number): number {
  const frame = frames[frameIndex];
  if (!frame || frames.length === 0) return 0;
  return controlChartX(frames, frame.offsetMin - frames[0].offsetMin, width);
}

/** 팬 가동률(%) 값 배열을 그래프 높이(px) 안의 y좌표로 변환(0=아래, yMax=위). */
export function controlChartY(value: number, height: number, yMax: number = CONTROL_CHART_Y_MAX): number {
  return height - clamp01(value / yMax) * height;
}

/**
 * values(145, frames와 같은 순서)를 SVG <path> d 속성 문자열로 바꾼다 — 기준선(점선)과
 * 최적화선(실선) 둘 다 이 함수 하나를 공유한다(점선 여부는 컴포넌트의 strokeDasharray로만
 * 다르게 그린다).
 */
export function buildControlLinePath(
  values: readonly number[],
  frames: readonly DetailFrame[],
  width: number,
  height: number,
  yMax: number = CONTROL_CHART_Y_MAX,
): string {
  if (frames.length === 0) return '';
  const start = frames[0].offsetMin;
  const commands: string[] = [];
  frames.forEach((frame, i) => {
    const v = values[i];
    if (v === undefined) return;
    const x = controlChartX(frames, frame.offsetMin - start, width);
    const y = controlChartY(v, height, yMax);
    commands.push(`${commands.length === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
  });
  return commands.join(' ');
}

export interface ControlChartTick {
  /** frames[0] 기준 상대 offsetMin(0, 360, 720, ...). */
  offsetMinFromStart: number;
  x: number;
  /** HH:mm — 해당 offset에 가장 가까운 프레임의 시각. */
  label: string;
}

function nearestFrameToOffset(frames: readonly DetailFrame[], targetOffsetMin: number): DetailFrame {
  let best = frames[0];
  let bestDiff = Math.abs(best.offsetMin - targetOffsetMin);
  for (const frame of frames) {
    const diff = Math.abs(frame.offsetMin - targetOffsetMin);
    if (diff < bestDiff) {
      best = frame;
      bestDiff = diff;
    }
  }
  return best;
}

/**
 * x축 6시간 간격 눈금(01-functional-spec.md 4.4 "x축 24시간 6시간 간격 눈금") — frames[0]
 * 시각부터 CONTROL_CHART_TICK_STEP_MIN(360분)마다 끊고, 끝이 정확히 맞아떨어지지 않으면
 * 마지막 프레임 시각을 끝 눈금으로 추가한다.
 */
export function buildControlChartTicks(
  frames: readonly DetailFrame[],
  width: number,
  stepMin: number = CONTROL_CHART_TICK_STEP_MIN,
): ControlChartTick[] {
  if (frames.length === 0) return [];
  const span = totalOffsetSpanMin(frames);
  const ticks: ControlChartTick[] = [];
  for (let offset = 0; offset < span; offset += stepMin) {
    const frame = nearestFrameToOffset(frames, frames[0].offsetMin + offset);
    ticks.push({ offsetMinFromStart: offset, x: controlChartX(frames, offset, width), label: formatFrameTime(frame.time) });
  }
  const last = frames[frames.length - 1];
  ticks.push({ offsetMinFromStart: span, x: width, label: formatFrameTime(last.time) });
  return ticks;
}
