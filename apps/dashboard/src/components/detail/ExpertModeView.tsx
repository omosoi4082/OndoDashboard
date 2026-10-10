// 전문가 모드(20~26, 01-functional-spec.md 4.3) — 입력 필드(21) 확인 클릭 시에만
// GET /api/detail/expert를 호출한다(탭 선택 자체로는 호출하지 않음, ForecastDetailView의
// "탭 선택 시 1회"와 다른 트리거). 입력 전(store.expert===null)에는 EmptyDetail3D로 방 모델과
// 중립색 포인트만 그리고 그 위에 안내 문구를 겹친다(01-functional-spec.md 3장 "데이터가 없을 때").
// 응답을 받은 뒤에는 ForecastDetailView와 같은 구조(ControlsRow + Detail3DView(포인트+
// 등치면/실린더 overlay) + Detail2DSection + Timeline)로 145프레임을 재생한다(중복 구현 금지).
import { useState, type ReactElement } from 'react';
import { useDetailStore } from '../../store/detailStore.js';
import { useIsosurfaceCache } from '../../hooks/useIsosurfaceCache.js';
import { clampTimelineFrameIndex } from '../../detail/timeline.js';
import { fetchDetailExpert } from '../../api/endpoints.js';
import { validateExpertInput, type ExpertInputDraft, type ExpertInputFieldRange } from '../../detail/expertInputValidation.js';
import {
  EXPERT_RH_MAX,
  EXPERT_RH_MIN,
  EXPERT_TEMP_MAX,
  EXPERT_TEMP_MIN,
  EXPERT_VENT_MAX,
  EXPERT_VENT_MIN,
} from '../../config/constants.js';
import { ControlsRow } from './ControlsRow.js';
import { Detail3DView, EmptyDetail3D } from './Detail3DView.js';
import { Detail2DSection } from './Detail2DSection.js';
import { Detail2DBox, Detail3DSection, TimelineSection } from './DetailSections.js';
import { DetailAreaMessage } from './DetailAreaMessage.js';
import { ExpertInputForm } from './ExpertInputForm.js';
import { IsosurfaceVolume } from '../../scene/IsosurfaceVolume.js';
import { FlowVisualization } from '../../scene/FlowVisualization.js';

const EXPERT_INPUT_RANGE: ExpertInputFieldRange = {
  tempMin: EXPERT_TEMP_MIN,
  tempMax: EXPERT_TEMP_MAX,
  rhMin: EXPERT_RH_MIN,
  rhMax: EXPERT_RH_MAX,
  ventMin: EXPERT_VENT_MIN,
  ventMax: EXPERT_VENT_MAX,
};

export function ExpertModeView(): ReactElement {
  const geometry = useDetailStore((s) => s.geometry);
  const expert = useDetailStore((s) => s.expert);
  const setExpert = useDetailStore((s) => s.setExpert);
  const valueField = useDetailStore((s) => s.valueField);
  const timelineFrameIndex = useDetailStore((s) => s.timelineFrameIndex);

  const [draft, setDraft] = useState<ExpertInputDraft>({ temp: '', rh: '', vent: '' });
  const [isLoading, setIsLoading] = useState(false);
  const validation = validateExpertInput(draft, EXPERT_INPUT_RANGE);

  // 입력 전·로딩 중엔 expertFrames를 null로 둬서 아래 렌더링이 "포인트 없음" 상태를
  // 그대로 따르게 한다(이전 입력 결과가 남아 있어도 로딩 중엔 보여주지 않는다).
  const expertFrames = !isLoading && expert && expert.status !== 'error' ? expert.data.frames : null;
  // 등치면 Worker는 항상 돌려 둔다(ForecastDetailView와 같은 이유 — 유동 선택 중이라도
  // 온도/습도로 전환 시 끊기지 않게).
  const isosurfaceCache = useIsosurfaceCache(geometry, expertFrames);

  function handleSubmit(): void {
    if (validation.temp.value === null || validation.rh.value === null || validation.vent.value === null) return;
    setIsLoading(true);
    fetchDetailExpert(validation.temp.value, validation.rh.value, validation.vent.value).then((res) => {
      setExpert(res);
      setIsLoading(false);
    });
  }

  if (!geometry) {
    return <DetailAreaMessage text="형상 데이터를 불러오는 중입니다..." isError={false} />;
  }

  const frameIndex = expertFrames ? clampTimelineFrameIndex(timelineFrameIndex, expertFrames.length) : 0;
  const frame = expertFrames ? expertFrames[frameIndex] : null;

  return (
    <>
      <ExpertInputForm
        draft={draft}
        validation={validation}
        isLoading={isLoading}
        isApplied={!isLoading && expert !== null && expert.status !== 'error'}
        onChange={setDraft}
        onSubmit={handleSubmit}
      />
      <ControlsRow />

      {isLoading ? (
        <EmptyDetail3D geometry={geometry} text="전문가 모드 결과를 계산하는 중입니다..." isError={false} />
      ) : expert === null ? (
        <EmptyDetail3D geometry={geometry} text="데이터 값을 입력해주세요." isError={false} />
      ) : expert.status === 'error' ? (
        <EmptyDetail3D geometry={geometry} text={expert.error.message} isError />
      ) : !frame ? (
        <EmptyDetail3D geometry={geometry} text="응답에 표시할 프레임이 없습니다." isError />
      ) : (
        <>
          <TimelineSection frames={expert.data.frames} />
          <Detail3DSection>
            <Detail3DView
              geometry={geometry}
              frame={frame}
              range={expert.data.range}
              overlay={
                valueField === 'flow' ? (
                  <FlowVisualization geometry={geometry} frame={frame} range={expert.data.range.flow} />
                ) : (
                  <IsosurfaceVolume
                    geometry={geometry}
                    range={expert.data.range}
                    valueField={valueField}
                    frameCache={isosurfaceCache.getFrame(frameIndex)}
                  />
                )
              }
            />
          </Detail3DSection>
          <Detail2DBox>
            <Detail2DSection geometry={geometry} frame={frame} range={expert.data.range} />
          </Detail2DBox>
        </>
      )}
    </>
  );
}
