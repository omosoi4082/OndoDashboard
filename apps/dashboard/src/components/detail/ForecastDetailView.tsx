// 예측 모드(14~19, 01-functional-spec.md 4.2) — GET /api/detail/forecast(탭 선택 시 1회,
// hooks/useForecastDetailOnDemand.ts) 응답을 타임라인으로 재생한다. 3D(입자)·2D 단면 그림은
// 현재 모드와 같은 Detail3DView가 그린다(중복 구현 금지). 2026-10-28부터 등치면·아래 2D 칸 없음.
import type { ReactElement } from 'react';
import { useDetailStore } from '../../store/detailStore.js';
import { qualityNotice } from '../../detail/qualityNotice.js';
import { clampTimelineFrameIndex } from '../../detail/timeline.js';
import { ControlsRow } from './ControlsRow.js';
import { Detail3DView, EmptyDetail3D } from './Detail3DView.js';
import { Detail3DSection, DetailScrollBody, TimelineSection } from './DetailSections.js';
import { DetailAreaMessage } from './DetailAreaMessage.js';

export function ForecastDetailView(): ReactElement {
  const geometry = useDetailStore((s) => s.geometry);
  const forecast = useDetailStore((s) => s.forecast);
  const timelineFrameIndex = useDetailStore((s) => s.timelineFrameIndex);

  if (!geometry) {
    return <DetailAreaMessage text="형상 데이터를 불러오는 중입니다..." isError={false} />;
  }

  if (forecast === null) {
    return (
      <>
        <ControlsRow />
        <DetailScrollBody>
          <EmptyDetail3D geometry={geometry} text="예측 결과를 계산하는 중입니다..." isError={false} />
        </DetailScrollBody>
      </>
    );
  }

  if (forecast.status === 'error') {
    return (
      <>
        <ControlsRow />
        <DetailScrollBody>
          <EmptyDetail3D geometry={geometry} text={forecast.error.message} isError />
        </DetailScrollBody>
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
        <DetailScrollBody>
          <EmptyDetail3D geometry={geometry} text="응답에 표시할 프레임이 없습니다." isError />
        </DetailScrollBody>
      </>
    );
  }

  return (
    <>
      <ControlsRow />
      <TimelineSection frames={frames} />
      <DetailScrollBody>
        <Detail3DSection>
          <Detail3DView geometry={geometry} frame={frame} range={range} notice={qualityNotice(frame)} />
        </Detail3DSection>
      </DetailScrollBody>
    </>
  );
}
