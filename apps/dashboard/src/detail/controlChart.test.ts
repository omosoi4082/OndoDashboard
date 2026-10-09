import { describe, expect, it } from 'vitest';
import type { DetailFrame } from '@ondo/shared';
import { buildControlChartTicks, buildControlLinePath, controlChartX, controlChartY, controlPlaybackX } from './controlChart.js';

const BASE_MINUTES_FROM_MIDNIGHT = 15 * 60 + 20; // 15:20 시작(design 레퍼런스와 동일)

function makeFrame(offsetMin: number): DetailFrame {
  const totalMinutes = (BASE_MINUTES_FROM_MIDNIGHT + offsetMin) % (24 * 60);
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return {
    offsetMin,
    time: `2026-10-09T${hh}:${mm}:00+09:00`,
    points: { temp: [], rh: [], flow: [] },
    grid: { temp: [], rh: [] },
    flow: [],
    outdoor: { T_out: null, RH_out: null, fan_pct: null },
    summary: { T_mean: 0, T_min: 0, T_max: 0, T_west: 0, T_east: 0, RH_mean: 0, V_mean: 0, V_max: 0 },
    quality: { in_range: true, warnings: [] },
  };
}

// frames[0].offsetMin=0(시각 15:20) ~ frames[144].offsetMin=1440(10분 간격 145개, +24시간).
const FRAMES: DetailFrame[] = Array.from({ length: 145 }, (_, i) => makeFrame(i * 10));

describe('controlChartX / controlChartY', () => {
  it('offsetMin 0은 x=0, 끝(1440)은 x=width', () => {
    expect(controlChartX(FRAMES, 0, 360)).toBe(0);
    expect(controlChartX(FRAMES, 1440, 360)).toBe(360);
  });

  it('offsetMin이 중간이면 폭의 중간 지점', () => {
    expect(controlChartX(FRAMES, 720, 360)).toBeCloseTo(180, 5);
  });

  it('value=0은 y=height(아래), value=yMax는 y=0(위)', () => {
    expect(controlChartY(0, 120, 100)).toBe(120);
    expect(controlChartY(100, 120, 100)).toBe(0);
    expect(controlChartY(50, 120, 100)).toBeCloseTo(60, 5);
  });
});

describe('buildControlLinePath', () => {
  it('프레임 수만큼 M/L 명령이 생기고 첫 명령은 M이다', () => {
    const values = FRAMES.map(() => 50);
    const path = buildControlLinePath(values, FRAMES, 360, 120, 100);
    expect(path.startsWith('M')).toBe(true);
    expect(path.split(' ')).toHaveLength(FRAMES.length);
    expect(path.split(' ').filter((c) => c.startsWith('L'))).toHaveLength(FRAMES.length - 1);
  });

  it('빈 frames면 빈 문자열', () => {
    expect(buildControlLinePath([], [], 360, 120)).toBe('');
  });
});

describe('controlPlaybackX', () => {
  it('첫 프레임은 x=0, 마지막 프레임은 x=width', () => {
    expect(controlPlaybackX(FRAMES, 0, 360)).toBe(0);
    expect(controlPlaybackX(FRAMES, FRAMES.length - 1, 360)).toBe(360);
  });

  it('존재하지 않는 인덱스는 0을 돌려준다', () => {
    expect(controlPlaybackX(FRAMES, 999, 360)).toBe(0);
  });
});

describe('buildControlChartTicks', () => {
  it('24시간을 6시간 간격으로 끊어 5개 눈금(0·6·12·18·24시간)을 만든다', () => {
    const ticks = buildControlChartTicks(FRAMES, 360);
    expect(ticks.map((t) => t.offsetMinFromStart)).toEqual([0, 360, 720, 1080, 1440]);
    expect(ticks[0].label).toBe('15:20');
    expect(ticks[ticks.length - 1].x).toBe(360);
  });
});
