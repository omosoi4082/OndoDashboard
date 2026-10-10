// 자돈방 2D 수평단면(13·19·26·33) — grid(온도·습도) 또는 flowGrid(유동, 유속 크기)에서
// SECTION_Z_M에 가장 가까운 층을 뽑아 2배 쌍선형 보간 후 canvas 히트맵 + 우측 그라데이션
// 범례(01-functional-spec.md 3장). 현재 모드에서도 보여줄지는 SHOW_2D_IN_CURRENT 플래그
// (config/constants.ts, 05-open-questions.md #15 확정에 따라 기본 true).
// 유동은 flowGrid가 grid와 해상도가 달라(9×8×4 vs 19×17×8) 별도 분기로 처리한다 — 색은
// FlowVec의 4번째 값(유속 크기)을 쓴다(2026-10-10 사용자 요청: "유동도 값에 따른 히트맵이
// 있어야 한다", 명세에 명시적 금지는 없고 그간 구현이 없었을 뿐이라 추가함).
import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import type { DetailBase, DetailFrame, Geometry, GridDef } from '@ondo/shared';
import { bilinearUpsample2x, extractZLayer, nearestZIndex } from '../../detail/sectionGrid.js';
import { buildHeatmapImage } from '../../detail/heatmapImage.js';
import { colormapRGB01 } from '../../detail/colormap.js';
import { niceAxisTicks } from '../../detail/axisTicks.js';
import { getFieldRange, getFieldUnit } from '../../detail/pointSelection.js';
import { useDetailStore } from '../../store/detailStore.js';
import { SECTION_PARTITION_SEGMENTS, SECTION_Z_M } from '../../config/constants.js';

interface Detail2DSectionProps {
  geometry: Geometry;
  frame: DetailFrame;
  range: DetailBase['range'];
}

const LEGEND_STEPS = 24;

export function Detail2DSection({ geometry, frame, range }: Detail2DSectionProps): ReactElement {
  const valueField = useDetailStore((s) => s.valueField);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 필드별로 어느 격자(해상도)·값 배열을 쓸지만 다르고, 그 뒤 보간·히트맵·범례 파이프라인은 같다.
  const activeGrid: GridDef = valueField === 'flow' ? geometry.flowGrid : geometry.grid;
  const values = useMemo(() => {
    if (valueField === 'temp') return frame.grid.temp;
    if (valueField === 'rh') return frame.grid.rh;
    return frame.flow.map((v) => v[3]); // 유속 크기
  }, [frame, valueField]);

  const upsampled = useMemo(() => {
    const k = nearestZIndex(activeGrid, SECTION_Z_M);
    const layer = extractZLayer(values, activeGrid, k);
    return bilinearUpsample2x(layer);
  }, [activeGrid, values]);

  const fieldRange = getFieldRange(range, valueField);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !upsampled || !fieldRange) return;
    const image = buildHeatmapImage(upsampled, fieldRange.min, fieldRange.max);
    if (image.width === 0 || image.height === 0) return;
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  }, [upsampled, fieldRange]);

  // 칸막이 오버레이 좌표계 — 히트맵 픽셀 i는 2배 보간 격자의 x = origin + i*(spacing/2) 노드를
  // 중심으로 그려지므로, viewBox를 반 픽셀씩 바깥으로 넓혀 canvas와 정확히 겹치게 한다.
  // canvas가 컨테이너에 맞춰 늘어나므로 SVG도 preserveAspectRatio="none"으로 똑같이 늘린다.
  // 칸막이 좌표(SECTION_PARTITION_SEGMENTS) 자체는 실제 room 좌표(m)라 어느 격자를 쓰든 그대로다.
  const stepX = activeGrid.spacing[0] / 2;
  const stepY = activeGrid.spacing[1] / 2;
  const viewMinX = activeGrid.origin[0] - stepX / 2;
  const viewMinY = activeGrid.origin[1] - stepY / 2;
  const viewW = (activeGrid.size[0] * 2 - 1) * stepX;
  const viewH = (activeGrid.size[1] * 2 - 1) * stepY;

  // X·Y축 칫수(m) — 참고 자료(Plotly 2D 히트맵)처럼 축에 실측 길이를 표기한다
  // (2026-10-10 사용자 요청). 보여주는 좌표 범위는 SVG 오버레이와 같은 viewBox 기준.
  const xTicks = useMemo(() => niceAxisTicks(viewMinX, viewMinX + viewW), [viewMinX, viewW]);
  const yTicks = useMemo(() => niceAxisTicks(viewMinY, viewMinY + viewH), [viewMinY, viewH]);

  const unit = getFieldUnit(valueField);
  const legendStops = Array.from({ length: LEGEND_STEPS }, (_, i) => {
    const t = i / (LEGEND_STEPS - 1);
    const [r, g, b] = colormapRGB01(t);
    const pct = ((1 - t) * 100).toFixed(1);
    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}) ${pct}%`;
  }).join(', ');

  return (
    <div className="flex h-full gap-3 rounded-lg border border-ondo-border bg-ondo-surface p-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-h-0 flex-1 gap-1">
          {/* Y축 칫수(m) — 아래 X축 행의 ml-8과 폭을 맞춰야 눈금이 캔버스와 정렬된다. */}
          <div className="relative w-7 shrink-0">
            {yTicks.map((v) => (
              <span
                key={v}
                className="absolute right-1 -translate-y-1/2 whitespace-nowrap text-[9px] text-white/50"
                style={{ top: `${((v - viewMinY) / viewH) * 100}%` }}
              >
                {v}m
              </span>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 rounded"
              style={{ width: '100%', height: '100%', imageRendering: 'auto' }}
            />
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox={`${viewMinX} ${viewMinY} ${viewW} ${viewH}`}
              preserveAspectRatio="none"
            >
              {SECTION_PARTITION_SEGMENTS.map(([[x1, y1], [x2, y2]], idx) => (
                <line
                  key={idx}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="white"
                  strokeWidth={2}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          </div>
        </div>
        {/* X축 칫수(m) */}
        <div className="relative ml-8 h-3 shrink-0">
          {xTicks.map((v) => (
            <span
              key={v}
              className="absolute -translate-x-1/2 whitespace-nowrap text-[9px] text-white/50"
              style={{ left: `${((v - viewMinX) / viewW) * 100}%` }}
            >
              {v}m
            </span>
          ))}
        </div>
      </div>
      <div className="flex w-10 flex-col items-center justify-between py-1 text-[10px] text-white/60">
        <span>
          {fieldRange.max.toFixed(1)}
          {unit}
        </span>
        <div className="my-1 w-3 flex-1 rounded" style={{ background: `linear-gradient(to bottom, ${legendStops})` }} />
        <span>
          {fieldRange.min.toFixed(1)}
          {unit}
        </span>
      </div>
    </div>
  );
}
