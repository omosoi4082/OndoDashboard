// 자돈방 2D 수평단면(13·19·26·33) — grid(온도·습도)에서 단면 높이(store sectionZ, 기본 SECTION_Z_M)의
// x·y 평면을 뽑아 2배 쌍선형 보간 후 canvas 히트맵으로 그린다(01-functional-spec.md 3장).
// 높이는 2026-10-28부터 "3D 자돈방" 줄 슬라이더로 바꾼다 — 층 사이는 위아래 층을 섞는다
// (interpolateZLayer, 전에는 가장 가까운 층 하나 — 0.5 m면 0.4 m층).
//
// 2026-10-28 온도 측 회신 1번 + 사용자 결정으로 **3D 화면 안에 겹치는 작은 그림**이 됐다:
// 아래 "2D 수평단면" 칸을 없애 3D를 키우고, 단면은 3D 오른쪽 범례 바로 아래에 둔다
// (Detail3DView.tsx). 범례는 3D와 같은 색 범위라 **하나만** 쓴다 — 여기서는 그리지 않는다.
// 유속 단면(flowGrid 히트맵)도 같은 날 없앴다(분석 항목에서 '유동'이 빠짐 — 온도 측: 같은 높이
// 유속이 0.01~0.07 m/s로 거의 한 색이었다).
import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import type { DetailBase, DetailFrame, Geometry } from '@ondo/shared';
import { bilinearUpsample2x, interpolateZLayer } from '../../detail/sectionGrid.js';
import { buildHeatmapImage } from '../../detail/heatmapImage.js';
import { axisTicksWithEnd } from '../../detail/axisTicks.js';
import { getFieldRange } from '../../detail/pointSelection.js';
import { useDetailStore, type AnalysisField } from '../../store/detailStore.js';
import { SECTION_INSET_WIDTH_PX, SECTION_PARTITION_SEGMENTS } from '../../config/constants.js';

interface Detail2DSectionProps {
  geometry: Geometry;
  frame: DetailFrame;
  range: DetailBase['range'];
  valueField: AnalysisField;
}

/** 축 눈금 라벨 — 부동소수 꼬리(4.500000000000001)를 없애고 정수는 소수점 없이 보여준다. */
function formatTick(v: number): string {
  return String(Number(v.toFixed(2)));
}
// Y축 숫자 칸 폭·X축 숫자 줄 높이(px). Y축 숫자~단면 4px, X축 숫자~단면 0px
// (2026-10-27 사용자: "세로 숫자와 단면 사이 갭은 4").
const Y_AXIS_GUTTER_PX = 26;
const Y_AXIS_GAP_PX = 4;
const X_AXIS_ROW_PX = 12;

export function Detail2DSection({ geometry, frame, range, valueField }: Detail2DSectionProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grid = geometry.grid;
  const values = valueField === 'temp' ? frame.grid.temp : frame.grid.rh;
  const sectionZ = useDetailStore((s) => s.sectionZ);

  const upsampled = useMemo(
    () => bilinearUpsample2x(interpolateZLayer(values, grid, sectionZ)),
    [grid, values, sectionZ],
  );

  const fieldRange = getFieldRange(range, valueField);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !upsampled || !fieldRange) return;
    const image = buildHeatmapImage(upsampled, fieldRange.min, fieldRange.max, valueField);
    if (image.width === 0 || image.height === 0) return;
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  }, [upsampled, fieldRange, valueField]);

  // 칸막이 오버레이 좌표계 — 히트맵 픽셀 i는 2배 보간 격자의 x = origin + i*(spacing/2) 노드를
  // 중심으로 그려지므로, viewBox를 반 픽셀씩 바깥으로 넓혀 canvas와 정확히 겹치게 한다.
  const stepX = grid.spacing[0] / 2;
  const stepY = grid.spacing[1] / 2;
  const viewMinX = grid.origin[0] - stepX / 2;
  const viewMinY = grid.origin[1] - stepY / 2;
  const viewW = (grid.size[0] * 2 - 1) * stepX;
  const viewH = (grid.size[1] * 2 - 1) * stepY;

  // X·Y축 칫수(m). 눈금은 격자 노드가 실제로 덮는 범위(= 방 크기)로 잡고 끝 값을 반드시 넣는다
  // (2026-10-13 온도 측 B-9: "방 폭은 4.5 m"). y = 0이 아래(2026-10-14 B-9 재검토 — 3D를 위에서
  // 본 방향과 같다). 히트맵(heatmapImage.ts row = height−1−j)·칸막이 SVG·y 눈금을 함께 뒤집는다.
  const axisMaxX = grid.origin[0] + (grid.size[0] - 1) * grid.spacing[0];
  const axisMaxY = grid.origin[1] + (grid.size[1] - 1) * grid.spacing[1];
  // 그림이 작아(폭 150px) 끝 값 바로 앞 눈금은 글자가 겹친다("4m4.5m") — 끝에서 0.6 m 안쪽 눈금은 뺀다.
  const xTicks = useMemo(
    () => axisTicksWithEnd(grid.origin[0], axisMaxX).filter((v) => v === axisMaxX || axisMaxX - v >= 0.6),
    [grid, axisMaxX],
  );
  const yTicks = useMemo(
    () => axisTicksWithEnd(grid.origin[1], axisMaxY).filter((v) => v === axisMaxY || axisMaxY - v >= 0.6),
    [grid, axisMaxY],
  );

  // 실제 방 가로세로 비율(m) 그대로 — 폭을 고정하고 높이를 비율로 정한다.
  const canvasW = SECTION_INSET_WIDTH_PX;
  const canvasH = canvasW * (viewH / viewW);

  return (
    <div data-testid="detail-section" className="rounded bg-[#141414]/50 p-1.5">
      <div className="mb-2 text-[10px] leading-none text-white/70">수평단면 {sectionZ.toFixed(1)}m</div>
      <div className="flex" style={{ height: canvasH, gap: Y_AXIS_GAP_PX }}>
        {/* Y축 칫수(m) — 아래 X축 줄의 marginLeft와 폭을 맞춰야 눈금이 캔버스와 정렬된다. */}
        <div className="relative shrink-0" style={{ width: Y_AXIS_GUTTER_PX }}>
          {yTicks.map((v) => (
            <span
              key={v}
              className="absolute right-0 -translate-y-1/2 whitespace-nowrap text-[9px] leading-none text-white/50"
              style={{ top: `${((viewMinY + viewH - v) / viewH) * 100}%` }}
            >
              {formatTick(v)}m
            </span>
          ))}
        </div>
        <div className="relative" style={{ width: canvasW }}>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 rounded-sm"
            style={{ width: '100%', height: '100%', imageRendering: 'auto' }}
          />
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`${viewMinX} ${viewMinY} ${viewW} ${viewH}`}
            preserveAspectRatio="none"
          >
            {/* SVG는 y가 아래로 커지므로 viewBox 세로 범위 안에서 위아래를 뒤집는다(y = 0이 아래). */}
            <g transform={`translate(0 ${2 * viewMinY + viewH}) scale(1 -1)`}>
              {SECTION_PARTITION_SEGMENTS.map(([[x1, y1], [x2, y2]], idx) => (
                <line
                  key={idx}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="white"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          </svg>
        </div>
      </div>
      {/* X축 칫수(m) */}
      <div
        className="relative"
        style={{ height: X_AXIS_ROW_PX, marginLeft: Y_AXIS_GUTTER_PX + Y_AXIS_GAP_PX, width: canvasW }}
      >
        {xTicks.map((v) => (
          <span
            key={v}
            className="absolute top-0.5 -translate-x-1/2 whitespace-nowrap text-[9px] leading-none text-white/50"
            style={{ left: `${((v - viewMinX) / viewW) * 100}%` }}
          >
            {formatTick(v)}m
          </span>
        ))}
      </div>
    </div>
  );
}
