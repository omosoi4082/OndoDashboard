// 전문가 모드(20~26, 01-functional-spec.md 4.3) — 입력 표(21, 24행 × 3열) 적용 클릭 시에만
// POST /api/detail/expert를 호출한다(탭 선택 자체로는 호출하지 않음, ForecastDetailView의
// "탭 선택 시 1회"와 다른 트리거).
//
// 2026-10-17 새 시안(docs/design/UI/전문가 모드 새 디자인/) 반영 — **화면이 둘로 나뉜다**:
//   input  : 패널 전체가 입력 표(ExpertInputForm). 분석 항목·타임라인·3D·2D 없음(시안 01~04-1).
//   result : 맨 윗줄에 "필수값 설정 … [필수값 수정]" 한 줄만 남고 그 아래 분석 항목 + 타임라인 +
//            3D(시안 05. 2D 단면은 2026-10-28부터 3D 안에 겹친 그림). ForecastDetailView와 같은 구조로 145프레임을 재생한다(중복 구현 금지).
// 전에는 입력 표가 결과 위에 상시 붙어 있었다. 오가는 길은 [필수값 수정] → input, [<] → result.
// 적용에 성공하면 자동으로 result로 넘어간다(시안 04 → 05 흐름).
// [<]는 "취소"다 — 적용하지 않은 편집(초기화로 비운 칸 포함)은 버리고 마지막으로 적용한 값으로
// 표를 되돌린다(2026-10-18 사용자 보고). 그러지 않으면 빈 표인 채로 결과 화면에 돌아가고,
// 다시 [필수값 수정]을 눌렀을 때 보이는 결과와 표가 어긋난다. 뒤로 가기를 막는 쪽(빈 칸이면
// 비활성)은 전부 비운 사용자가 결과로 돌아갈 길을 잃으므로 택하지 않았다.
//
// 입력 전·오류일 때는 result로 가지 않으므로, "데이터 값을 입력해주세요" 안내를 겹친 EmptyDetail3D는
// 더 이상 쓰지 않는다 — 그 자리에 입력 표 자체가 보이는 것이 시안의 빈 상태다.
import { useState, type ReactElement } from 'react';
import { useDetailStore } from '../../store/detailStore.js';
import { clampTimelineFrameIndex } from '../../detail/timeline.js';
import { fetchDetailExpert } from '../../api/endpoints.js';
import { validateExpertRows, type ExpertInputFieldRange, type ExpertRowDraft } from '../../detail/expertInputValidation.js';
import { expertEmptyDrafts, expertExampleDrafts, expertRowLabels } from '../../detail/expertInputRows.js';
import { qualityNotice } from '../../detail/qualityNotice.js';
import {
  EXPERT_INPUT_ROW_COUNT,
  EXPERT_RH_MAX,
  EXPERT_RH_MIN,
  EXPERT_TEMP_MAX,
  EXPERT_TEMP_MIN,
  EXPERT_VENT_MAX,
  EXPERT_VENT_MIN,
} from '../../config/constants.js';
import { ControlsRow } from './ControlsRow.js';
import { Detail3DView, EmptyDetail3D } from './Detail3DView.js';
import { Detail3DSection, DetailScrollBody, TimelineSection } from './DetailSections.js';
import { DetailAreaMessage } from './DetailAreaMessage.js';
import { ExpertInputForm } from './ExpertInputForm.js';
import { ExpertResultHeader } from './ExpertResultHeader.js';

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
  const timelineFrameIndex = useDetailStore((s) => s.timelineFrameIndex);

  // 행 라벨은 "0시"~"23시" 고정이다(2026-10-17 시안). 표는 빈 칸으로 시작한다.
  const rowLabels = expertRowLabels(EXPERT_INPUT_ROW_COUNT);
  const [drafts, setDrafts] = useState<ExpertRowDraft[]>(() => expertEmptyDrafts(EXPERT_INPUT_ROW_COUNT));
  // 마지막으로 적용에 성공한 입력값. 결과 화면이 보여주는 것이 이 값의 결과이므로, [<]로 돌아갈 때
  // 표를 이 값으로 되돌린다. 아직 적용한 적이 없으면 null(= 뒤로 갈 결과도 없다).
  const [appliedDrafts, setAppliedDrafts] = useState<ExpertRowDraft[] | null>(null);
  // 'input' = 입력 표 화면(시안 01~04-1), 'result' = 결과 화면(시안 05).
  // 처음에는 결과가 없으니 입력 화면으로 시작하고, 적용에 성공하면 결과로 넘어간다.
  const [screen, setScreen] = useState<'input' | 'result'>('input');
  const [isLoading, setIsLoading] = useState(false);
  const validation = validateExpertRows(drafts, EXPERT_INPUT_RANGE, EXPERT_INPUT_ROW_COUNT);

  // 입력 전·로딩 중엔 expertFrames를 null로 둬서 아래 렌더링이 "포인트 없음" 상태를
  // 그대로 따르게 한다(이전 입력 결과가 남아 있어도 로딩 중엔 보여주지 않는다).
  const expertFrames = !isLoading && expert && expert.status !== 'error' ? expert.data.frames : null;

  function handleSubmit(): void {
    if (validation.values === null) return;
    setIsLoading(true);
    // 응답이 오기까지 사용자가 칸을 더 고칠 수 있으니, 보낸 시점의 표를 복사해 둔다.
    const submitted = drafts.map((row) => ({ ...row }));
    // 계산 중에도 입력 표를 그대로 두고(화면이 비는 것보다 낫다) 결과가 오면 결과 화면으로 넘어간다.
    // 오류 응답이면 입력 화면에 남아 아래 오류 문구를 띄운다 — 값을 고칠 자리가 그 화면이다.
    fetchDetailExpert(validation.values).then((res) => {
      setExpert(res);
      setIsLoading(false);
      if (res.status !== 'error') {
        setAppliedDrafts(submitted);
        setScreen('result');
      }
    });
  }

  /** [<] 뒤로 가기(시안 04-1) — 적용하지 않은 편집을 버리고 마지막으로 적용한 값으로 표를
   *  되돌린 뒤 결과 화면으로 간다. */
  function handleBack(): void {
    if (appliedDrafts === null) return;
    setDrafts(appliedDrafts.map((row) => ({ ...row })));
    setScreen('result');
  }

  /** "초기화"(시안 02~04-1) — 입력 표를 빈 칸으로 되돌린다. 이미 받은 결과는 지우지 않는다
   *  (결과 화면으로 돌아갈 수 있어야 하므로). */
  function handleReset(): void {
    setDrafts(expertEmptyDrafts(EXPERT_INPUT_ROW_COUNT));
  }

  /** "예시값"(2026-10-19 온도 측 승인, 05-open-questions.md #52) — 표가 비어 있을 때만 보이는
   *  버튼이라 덮어쓸 입력이 없다. 채운 뒤에는 그 자리가 시안대로 "초기화"로 바뀐다. */
  function handleFillExample(): void {
    setDrafts(expertExampleDrafts(EXPERT_INPUT_ROW_COUNT));
  }

  if (!geometry) {
    return <DetailAreaMessage text="형상 데이터를 불러오는 중입니다..." isError={false} />;
  }

  const frameIndex = expertFrames ? clampTimelineFrameIndex(timelineFrameIndex, expertFrames.length) : 0;
  const frame = expertFrames ? expertFrames[frameIndex] : null;

  const hasResult = expert !== null && expert.status !== 'error' && frame !== null;

  // ── 입력 화면(시안 01~04-1) ─────────────────────────────────────────────
  // 패널 전체가 입력 표다. 결과를 이미 받아 둔 경우에만 "<"로 결과 화면에 돌아갈 수 있다.
  if (screen === 'input') {
    return (
      <>
        <ExpertInputForm
          rowLabels={rowLabels}
          drafts={drafts}
          validation={validation}
          isLoading={isLoading}
          onBack={hasResult && appliedDrafts !== null ? handleBack : null}
          onChange={setDrafts}
          onReset={handleReset}
          onFillExample={handleFillExample}
          onSubmit={handleSubmit}
        />
        {isLoading && (
          <span className="shrink-0 pt-2.5 text-xs text-white/60">전문가 모드 결과를 계산하는 중입니다...</span>
        )}
        {!isLoading && expert !== null && expert.status === 'error' && (
          <span className="shrink-0 pt-2.5 text-xs text-[#ff695b]">{expert.error.message}</span>
        )}
      </>
    );
  }

  // ── 결과 화면(시안 05) ──────────────────────────────────────────────────
  return (
    <>
      <ExpertResultHeader onEdit={() => setScreen('input')} />
      <ControlsRow />

      {/* frame이 있을 때만(= 로딩도 오류도 아니고 데이터도 있을 때만) 타임라인을 보여준다
          — expertFrames와 같은 조건이라 그 참 거짓만 보면 된다. */}
      {expertFrames && frame && <TimelineSection frames={expertFrames} elapsedLabels />}

      <DetailScrollBody>
        {!frame || expert === null || expert.status === 'error' ? (
          <EmptyDetail3D geometry={geometry} text="응답에 표시할 프레임이 없습니다." isError />
        ) : (
          <>
            <Detail3DSection>
              <Detail3DView
                geometry={geometry}
                frame={frame}
                range={expert.data.range}
                notice={qualityNotice(frame)}
              />
            </Detail3DSection>
          </>
        )}
      </DetailScrollBody>
    </>
  );
}
