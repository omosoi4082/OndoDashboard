// 자돈방 2D 수평단면(13·19·26·33) — grid(온도·습도) 또는 flowGrid(유동, 유속 크기)에서
// SECTION_Z_M에 가장 가까운 층을 뽑아 2배 쌍선형 보간 후 canvas 히트맵 + 우측 그라데이션
// 범례(01-functional-spec.md 3장). 현재 모드에서도 보여줄지는 SHOW_2D_IN_CURRENT 플래그
// (config/constants.ts, 05-open-questions.md #15 확정에 따라 기본 true).
// 유동은 flowGrid가 grid와 해상도가 달라(9×8×4 vs 19×17×8) 별도 분기로 처리한다 — 색은
// FlowVec의 4번째 값(유속 크기)을 쓴다(2026-10-10 사용자 요청: "유동도 값에 따른 히트맵이
// 있어야 한다", 명세에 명시적 금지는 없고 그간 구현이 없었을 뿐이라 추가함).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { DetailBase, DetailFrame, Geometry, GridDef } from '@ondo/shared';
import { bilinearUpsample2x, extractZLayer, nearestZIndex } from '../../detail/sectionGrid.js';
import { buildHeatmapImage } from '../../detail/heatmapImage.js';
import { axisTicksWithEnd } from '../../detail/axisTicks.js';
import { getFieldRange } from '../../detail/pointSelection.js';
import { useDetailStore } from '../../store/detailStore.js';
import { SECTION_PARTITION_SEGMENTS, SECTION_Z_M } from '../../config/constants.js';
import { ColorLegend } from './ColorLegend.js';

interface Detail2DSectionProps {
  geometry: Geometry;
  frame: DetailFrame;
  range: DetailBase['range'];
}

/** 축 눈금 라벨 — 부동소수 꼬리(4.500000000000001)를 없애고 정수는 소수점 없이 보여준다. */
function formatTick(v: number): string {
  return String(Number(v.toFixed(2)));
}
// 평면도:범례 가로 배분 — 2026-10-10 사용자 요청: "평면도 70% 간격에 중앙 배치, 범례는
// 30% 간격에 중앙 배치, 이상하면 60/40으로 바꿀 것". 비율 하나만 바꾸면 전체에 반영된다.
const PLAN_WIDTH_SHARE = 0.6;
// 레이아웃 고정 여백(px) — 가로세로 비율 맞춤 계산에 쓴다. Tailwind 클래스(w-7=28, h-3=12)와
// 값이 어긋나지 않게 같이 바꿔야 한다.
// 2026-10-27 사용자: "사각 프레임 패딩 없이, 숫자와 단면도 사이 갭도 없이" → 그 뒤 "단면 위에
// 패딩 2만 주고 세로 숫자와 단면 사이 갭은 2 정도". 그래서 위 패딩 2px, Y축 숫자~단면 2px,
// X축 숫자~단면 0px이다.
const Y_AXIS_GUTTER_PX = 28;
const X_AXIS_ROW_PX = 12;
/** Y축 숫자와 단면 사이(px). */
const Y_AXIS_GAP_PX = 2;
/** X축 숫자와 단면 사이(px). */
const X_AXIS_GAP_PX = 0;
/** 사각 프레임 위 패딩(px) — 좌우·아래는 0이다. */
const FRAME_TOP_PAD_PX = 2;

export function Detail2DSection({ geometry, frame, range }: Detail2DSectionProps): ReactElement {
  const valueField = useDetailStore((s) => s.valueField);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [areaSize, setAreaSize] = useState({ width: 0, height: 0 });

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
  // canvas가 컨테이너에 맞춰 늘어나므로 SVG도 preserveAspectRatio="none"으로 똑같이 늘린다.
  // 칸막이 좌표(SECTION_PARTITION_SEGMENTS) 자체는 실제 room 좌표(m)라 어느 격자를 쓰든 그대로다.
  const stepX = activeGrid.spacing[0] / 2;
  const stepY = activeGrid.spacing[1] / 2;
  const viewMinX = activeGrid.origin[0] - stepX / 2;
  const viewMinY = activeGrid.origin[1] - stepY / 2;
  const viewW = (activeGrid.size[0] * 2 - 1) * stepX;
  const viewH = (activeGrid.size[1] * 2 - 1) * stepY;

  // X·Y축 칫수(m) — 참고 자료(Plotly 2D 히트맵)처럼 축에 실측 길이를 표기한다
  // (2026-10-10 사용자 요청).
  //
  // 눈금 범위는 viewBox(픽셀 중심 기준으로 반 칸 바깥까지 넓힌 범위)가 아니라 **격자 노드가
  // 실제로 덮는 범위**(origin ~ origin+(size−1)×spacing)로 잡는다. 온도·습도 grid는 그게
  // 곧 방 크기(x 0~4.5 m, y 0~4.0 m)다. 눈금 위치는 그대로 viewBox 기준으로 환산해
  // 캔버스와 정렬한다.
  //
  // axisTicksWithEnd로 끝 값을 반드시 포함시킨다 — 2026-10-13 온도 측 B-9:
  // "x축 눈금이 4 m에서 끝나는데 방 폭은 4.5 m입니다". 나이스 넘버만 쓰면 0·1·2·3·4로
  // 끝나 방이 4 m인 것처럼 보였다.
  //
  // y축은 **y = 0이 아래**(2026-10-14 B-9 재검토). 온도 측 평면도(그림 1)가 y = 0이 아래이고,
  // 3D 상세보기도 좌표 변환을 회전((x, z, −y), scene/coords.ts)으로 고쳐 위에서 보면 같은
  // 방향이 됐다. 전에는 3D가 거울상((x, z, y) 반사)이라 2D를 y = 0이 위로 맞춰 두었었다.
  // 히트맵(heatmapImage.ts row = height−1−j)·칸막이 SVG(아래 <g> 뒤집기)·y 눈금을 함께 뒤집는다.
  const axisMaxX = activeGrid.origin[0] + (activeGrid.size[0] - 1) * activeGrid.spacing[0];
  const axisMaxY = activeGrid.origin[1] + (activeGrid.size[1] - 1) * activeGrid.spacing[1];
  const xTicks = useMemo(() => axisTicksWithEnd(activeGrid.origin[0], axisMaxX), [activeGrid, axisMaxX]);
  const yTicks = useMemo(() => axisTicksWithEnd(activeGrid.origin[1], axisMaxY), [activeGrid, axisMaxY]);

  // 실제 방 가로세로 비율(m)을 그대로 유지한 채 영역 안에 맞춘다(2026-10-10 사용자 확인 —
  // "가로가 너무 길다, 비율이 안 받는다". 이전엔 SVG preserveAspectRatio="none"으로 캔버스를
  // 컨테이너 모양에 맞춰 억지로 늘렸었다). 컨테이너 크기는 ResizeObserver로 재서 JS로 직접
  // 가로세로를 계산한다 — CSS aspect-ratio만으로는 (Y축 눈금 칸 폭 같은) 고정 여백이 섞인
  // 레이아웃에서 양쪽 방향 모두를 안정적으로 줄이지 못한다.
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setAreaSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const canvasW = Math.max(0, areaSize.width - Y_AXIS_GUTTER_PX - Y_AXIS_GAP_PX);
  const canvasHFromW = canvasW / (viewW / viewH);
  const canvasHCap = Math.max(0, areaSize.height - X_AXIS_ROW_PX - X_AXIS_GAP_PX);
  const fittedCanvasH = Math.min(canvasHFromW, canvasHCap);
  const fittedCanvasW = fittedCanvasH * (viewW / viewH);

  return (
    <div
      className="flex h-full gap-2.5 rounded-lg border border-ondo-border bg-ondo-surface"
      style={{ paddingTop: FRAME_TOP_PAD_PX }}
    >
      {/* 실제 치수 비율대로 맞춘 박스를 이 영역 안에서 가운데 정렬한다(남는 공간은 레터박스). */}
      <div
        ref={areaRef}
        className="flex min-h-0 min-w-0 shrink-0 items-center justify-center"
        style={{ width: `${PLAN_WIDTH_SHARE * 100}%` }}
      >
        <div style={{ width: fittedCanvasW + Y_AXIS_GUTTER_PX + Y_AXIS_GAP_PX }}>
          <div className="flex" style={{ height: fittedCanvasH, gap: Y_AXIS_GAP_PX }}>
            {/* Y축 칫수(m) — 아래 X축 행의 marginLeft와 폭을 맞춰야 눈금이 캔버스와 정렬된다. */}
            <div className="relative shrink-0" style={{ width: Y_AXIS_GUTTER_PX }}>
              {yTicks.map((v) => (
                <span
                  key={v}
                  className="absolute right-0 -translate-y-1/2 whitespace-nowrap text-[9px] text-white/50"
                  style={{ top: `${((viewMinY + viewH - v) / viewH) * 100}%` }}
                >
                  {formatTick(v)}m
                </span>
              ))}
            </div>
            <div className="relative" style={{ width: fittedCanvasW }}>
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
                    strokeWidth={2}
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
            className="relative shrink-0"
            style={{
              height: X_AXIS_ROW_PX,
              marginTop: X_AXIS_GAP_PX,
              marginLeft: Y_AXIS_GUTTER_PX + Y_AXIS_GAP_PX,
              width: fittedCanvasW,
            }}
          >
            {xTicks.map((v) => (
              <span
                key={v}
                className="absolute -translate-x-1/2 whitespace-nowrap text-[9px] text-white/50"
                style={{ left: `${((v - viewMinX) / viewW) * 100}%` }}
              >
                {formatTick(v)}m
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-stretch justify-center py-1" style={{ width: `${(1 - PLAN_WIDTH_SHARE) * 100}%` }}>
        <ColorLegend range={range} valueField={valueField} />
      </div>
    </div>
  );
}
