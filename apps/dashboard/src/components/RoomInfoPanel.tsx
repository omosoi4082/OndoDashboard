// 정보 판넬(5-1~5-3) — 방 호버 시 온도·습도·환기량(FAN1 %)·NH3·CO2 표시, 3개 방 모두
// (01-functional-spec.md 2장 #5). 환기량은 FAN1 가동률(%)만 쓴다(FAN2·FAN3 금지).
//
// docs/design/screen-design.png(on-01 ④⑤) 기준 — 3D 모델 위에 떠 있는 말풍선 콜아웃이다.
// 하단 고정 바가 아니라, 호버된 방의 3D 좌표를 투영한 위치에 scene/OverviewScene.tsx가
// drei Html로 띄운다(호버 중일 때만 마운트되므로 이 컴포넌트는 항상 "호버 중" 내용만
// 그린다 — hidden/placeholder 상태 없음).
import type { ReactElement } from 'react';
import type { RoomId, RoomSummary } from '@ondo/shared';
import { formatValueOrDash } from '../utils/formatValue.js';

interface RoomInfoPanelProps {
  roomId: RoomId;
  summary: RoomSummary | null;
}

export function RoomInfoPanel({ roomId, summary }: RoomInfoPanelProps): ReactElement {
  const name = summary?.name ?? roomId;

  return (
    <div className="-translate-x-1/2 -translate-y-full">
      <div className="relative min-w-[160px] rounded-lg border border-cyan-400/60 bg-[#121620]/95 px-3 py-2 shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-white/90">{name}</span>
          {summary?.sourceStatus === 'disconnected' && (
            <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">끊김</span>
          )}
        </div>
        <dl className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-white/70">
          <dt>온도</dt>
          <dd>{formatValueOrDash(summary?.temp ?? null, '℃')}</dd>
          <dt>습도</dt>
          <dd>{formatValueOrDash(summary?.rh ?? null, '%')}</dd>
          <dt>환기량(FAN1)</dt>
          <dd>{formatValueOrDash(summary?.fanRate ?? null, '%')}</dd>
          <dt>NH3</dt>
          <dd>{formatValueOrDash(summary?.nh3 ?? null, 'ppm')}</dd>
          <dt>CO2</dt>
          <dd>{formatValueOrDash(summary?.co2 ?? null, 'ppm')}</dd>
        </dl>
        {/* 말풍선 꼬리 — 앵커(방 중심 바로 위) 지점을 가리킨다. */}
        <div className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-cyan-400/60 bg-[#121620]/95" />
      </div>
    </div>
  );
}
