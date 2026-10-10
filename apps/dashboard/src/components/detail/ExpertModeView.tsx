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
import { Detail2DBox, Detail3DSection, DetailScrollBody, TimelineSection } from './DetailSections.js';
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
  // 마지막으로 "적용"을 눌렀던 입력값 — 지금 draft와 같을 때만 "적용 완료" 상태로 본다.
  // 적용 후 값을 다시 바꾸면 draft !== appliedDraft가 되어 버튼이 "적용"으로 돌아간다
  // (2026-10-10 사용자 요청: "적용완료후 다시 인풋값 입력시 적용으로 버튼 변경되야됨").
  const [appliedDraft, setAppliedDraft] = useState<ExpertInputDraft | null>(null);
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
      setAppliedDraft(draft);
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
        isApplied={
          !isLoading &&
          expert !== null &&
          expert.status !== 'error' &&
          appliedDraft !== null &&
          appliedDraft.temp === draft.temp &&
          appliedDraft.rh === draft.rh &&
          appliedDraft.vent === draft.vent
        }
        onChange={setDraft}
        onSubmit={handleSubmit}
      />
      {/* 입력 폼과 분석 항목 사이 구분선 — Figma node 374:11732(03_전문가모드_디자인) 실측,
          ControlsRow 자체엔 없어서(다른 모드는 탭 바로 아래라 필요 없음) 여기서만 그린다. */}
      <div className="h-px shrink-0 bg-ondo-border" />
      <ControlsRow />

      {/* frame이 있을 때만(= 로딩도 오류도 아니고 데이터도 있을 때만) 타임라인을 보여준다
          — expertFrames와 같은 조건이라 그 참 거짓만 보면 된다. */}
      {expertFrames && frame && <TimelineSection frames={expertFrames} />}

      <DetailScrollBody>
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
      </DetailScrollBody>
    </>
  );
}
