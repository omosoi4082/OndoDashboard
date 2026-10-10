// 자돈방 2D 수평단면(13·19·26·33) — grid에서 SECTION_Z_M 층을 뽑아 2배 쌍선형 보간 후
// canvas 히트맵 + 우측 그라데이션 범례(01-functional-spec.md 3장). 현재 모드에서도 보여줄지는
// SHOW_2D_IN_CURRENT 플래그(config/constants.ts, 05-open-questions.md #15 확정에 따라 기본 true).
// grid에는 온도·습도만 있고(flowGrid는 별도 288노드, M5) 유동 토글에서는 2D를 그릴 수 없다.
import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import type { DetailBase, DetailFrame, Geometry } from '@ondo/shared';
import { bilinearUpsample2x, extractZLayer, nearestZIndex } from '../../detail/sectionGrid.js';
import { buildHeatmapImage } from '../../detail/heatmapImage.js';
import { colormapRGB01 } from '../../detail/colormap.js';
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

  const upsampled = useMemo(() => {
    if (valueField === 'flow') return null;
    const values = valueField === 'temp' ? frame.grid.temp : frame.grid.rh;
    const k = nearestZIndex(geometry.grid, SECTION_Z_M);
    const layer = extractZLayer(values, geometry.grid, k);
    return bilinearUpsample2x(layer);
  }, [geometry.grid, frame, valueField]);

  const fieldRange = valueField === 'flow' ? null : getFieldRange(range, valueField);

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

  if (valueField === 'flow' || !fieldRange) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-ondo-border bg-ondo-surface text-xs text-white/40">
        유동은 2D 단면에 표시되지 않습니다
      </div>
    );
  }

  // 칸막이 오버레이 좌표계 — 히트맵 픽셀 i는 2배 보간 격자의 x = origin + i*(spacing/2) 노드를
  // 중심으로 그려지므로, viewBox를 반 픽셀씩 바깥으로 넓혀 canvas와 정확히 겹치게 한다.
  // canvas가 컨테이너에 맞춰 늘어나므로 SVG도 preserveAspectRatio="none"으로 똑같이 늘린다.
  const stepX = geometry.grid.spacing[0] / 2;
  const stepY = geometry.grid.spacing[1] / 2;
  const viewMinX = geometry.grid.origin[0] - stepX / 2;
  const viewMinY = geometry.grid.origin[1] - stepY / 2;
  const viewW = (geometry.grid.size[0] * 2 - 1) * stepX;
  const viewH = (geometry.grid.size[1] * 2 - 1) * stepY;

  const unit = getFieldUnit(valueField);
  const legendStops = Array.from({ length: LEGEND_STEPS }, (_, i) => {
    const t = i / (LEGEND_STEPS - 1);
    const [r, g, b] = colormapRGB01(t);
    const pct = ((1 - t) * 100).toFixed(1);
    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}) ${pct}%`;
  }).join(', ');

  return (
    <div className="flex h-full gap-3 rounded-lg border border-ondo-border bg-ondo-surface p-2">
      <div className="relative flex-1">
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
