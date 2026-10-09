// 예측 모드(14~19, 01-functional-spec.md 4.2) — GET /api/detail/forecast(탭 선택 시 1회,
// hooks/useForecastDetailOnDemand.ts) 응답을 타임라인으로 재생한다. 3D/2D는 현재 모드와
// 같은 컴포넌트(Detail3DView/Detail2DSection)를 그대로 재사용하고, Detail3DView의 overlay
// 슬롯에 valueField에 맞춰 IsosurfaceVolume(온도·습도) 또는 FlowCylinders(유동)를 추가로
// 얹는다(중복 구현 금지).
import type { ReactElement } from 'react';
import { useDetailStore } from '../../store/detailStore.js';
import { useIsosurfaceCache } from '../../hooks/useIsosurfaceCache.js';
import { clampTimelineFrameIndex } from '../../detail/timeline.js';
import { ControlsRow } from './ControlsRow.js';
import { Detail3DView } from './Detail3DView.js';
import { Detail2DSection } from './Detail2DSection.js';
import { Timeline } from './Timeline.js';
import { DetailAreaMessage } from './DetailAreaMessage.js';
import { IsosurfaceVolume } from '../../scene/IsosurfaceVolume.js';
import { FlowCylinders } from '../../scene/FlowCylinders.js';

export function ForecastDetailView(): ReactElement {
  const geometry = useDetailStore((s) => s.geometry);
  const forecast = useDetailStore((s) => s.forecast);
  const valueField = useDetailStore((s) => s.valueField);
  const timelineFrameIndex = useDetailStore((s) => s.timelineFrameIndex);

  const forecastFrames = forecast && forecast.status !== 'error' ? forecast.data.frames : null;
  // grid 2배 삼선형 보간은 Worker에서 프레임 전체를 미리 계산·캐시한다(docs/04-tasks.md M5) —
  // valueField가 '유동'이라 당장 안 쓰여도 등치면 전환 시 끊기지 않도록 항상 돌려 둔다.
  const isosurfaceCache = useIsosurfaceCache(geometry, forecastFrames);

  if (!geometry) {
    return <DetailAreaMessage text="형상 데이터를 불러오는 중입니다..." isError={false} />;
  }

  if (forecast === null) {
    return (
      <>
        <ControlsRow />
        <DetailAreaMessage text="예측 결과를 계산하는 중입니다..." isError={false} />
      </>
    );
  }

  if (forecast.status === 'error') {
    return (
      <>
        <ControlsRow />
        <DetailAreaMessage text={forecast.error.message} isError />
      </>
    );
  }

  const { frames, range } = forecast.data;
  const frameIndex = clampTimelineFrameIndex(timelineFrameIndex, frames.length);
  const frame = frames[frameIndex];

  if (!frame) {
    return (
      <>
        <ControlsRow />
        <DetailAreaMessage text="응답에 표시할 프레임이 없습니다." isError />
      </>
    );
  }

  const overlay =
    valueField === 'flow' ? (
      <FlowCylinders geometry={geometry} frame={frame} range={range.flow} />
    ) : (
      <IsosurfaceVolume
        geometry={geometry}
        range={range}
        valueField={valueField}
        frameCache={isosurfaceCache.getFrame(frameIndex)}
      />
    );

  return (
    <>
      <ControlsRow />
      <div className="h-[340px] shrink-0">
        <Detail3DView geometry={geometry} frame={frame} range={range} overlay={overlay} />
      </div>
      <div className="h-[220px] shrink-0">
        <Detail2DSection geometry={geometry} frame={frame} range={range} />
      </div>
      <Timeline frames={frames} />
    </>
  );
}
