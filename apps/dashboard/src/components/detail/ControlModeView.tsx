// 제어 모드(27~34, 01-functional-spec.md 4.4) — 탭 선택 시(target=energy 기본)와 에너지/
// 환경 최적화 버튼 전환 시 둘 다 GET /api/detail/control을 다시 호출한다(예측 모드의
// "탭당 1회"와 다른 패턴이라 useForecastDetailOnDemand를 쓰지 않고 이 컴포넌트가 직접
// target을 상태로 들고 effect에서 관리한다). 3D/2D/타임라인은 ForecastDetailView와 같은
// 구조를 재사용하고, 3D 영역(32) 위에 환기량 비교 그래프 카드(34, C안)를
// Detail3DView의 htmlOverlay 슬롯으로 얹는다.
import { useEffect, useState, type ReactElement } from 'react';
import type { ControlDetail } from '@ondo/shared';
import { useDetailStore } from '../../store/detailStore.js';
import { useIsosurfaceCache } from '../../hooks/useIsosurfaceCache.js';
import { clampTimelineFrameIndex } from '../../detail/timeline.js';
import { fetchDetailControl } from '../../api/endpoints.js';
import { ControlsRow } from './ControlsRow.js';
import { Detail3DView, EmptyDetail3D } from './Detail3DView.js';
import { Detail2DSection } from './Detail2DSection.js';
import { Detail2DBox, Detail3DSection, TimelineSection } from './DetailSections.js';
import { DetailAreaMessage } from './DetailAreaMessage.js';
import { ControlSummaryCard } from './ControlSummaryCard.js';
import { IsosurfaceVolume } from '../../scene/IsosurfaceVolume.js';
import { FlowVisualization } from '../../scene/FlowVisualization.js';

type ControlTarget = ControlDetail['target'];

// 아이콘은 docs/design/icon/{에너지최적화,환경최적화}.png → public/assets/icons/control/
// (weatherIcon.ts와 같은 패턴, 영문 파일명 복사본, 2026-10-11 사용자 전달).
const TARGETS: ReadonlyArray<{ id: ControlTarget; label: string; icon: string }> = [
  { id: 'energy', label: '에너지 최적화', icon: '/assets/icons/control/energy.png' },
  { id: 'environment', label: '환경 최적화', icon: '/assets/icons/control/environment.png' },
];

// 버튼 728×56, radius 8, 글씨 16px, 선택 #ffffff·비선택 #a4abb5(2026-10-11 사용자 실측
// 지시). 컨테이너를 w-full·버튼을 flex-1로 둬 폭을 하드코딩하지 않고 카드 폭(패널 기준
// 728px)에 맞춘다 — gap-2(8px)까지 합치면 실측값과 같다. 배경색은 04_제어모드_디자인_01
// 픽셀 실측(선택 rgb(60,88,128), 비선택 rgb(48,50,55)). 선택 버튼엔 채움보다 밝은 파란
// 테두리(실측 rgb(42,100,156))가 있다(2026-10-11 사용자: "선택 버튼에 테두리 있어").
function ControlTargetToggle({
  target,
  disabled,
  onChange,
}: {
  target: ControlTarget;
  disabled: boolean;
  onChange: (next: ControlTarget) => void;
}): ReactElement {
  return (
    <div className="flex h-14 w-full shrink-0 gap-2">
      {TARGETS.map(({ id, label, icon }) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(id)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg border text-base transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            target === id
              ? 'border-[#2a649c] bg-[#3c5880] text-white'
              : 'border-transparent bg-[#303237] text-[#a4abb5] hover:text-white'
          }`}
        >
          {/* 흰색 고정 PNG라 <img>로는 선택/비선택 글씨 색을 따라가지 않는다 — CSS mask로
              바꿔 bg-current가 버튼 글씨 색(흰색/#a4abb5)을 그대로 따르게 한다(2026-10-11
              사용자: "아이콘도 선택 비선택 색상이 글씨와 같아야지"). */}
          <span
            aria-hidden="true"
            className="h-[18px] w-[18px] shrink-0 bg-current"
            style={{
              WebkitMaskImage: `url(${icon})`,
              maskImage: `url(${icon})`,
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
            }}
          />
          {label}
        </button>
      ))}
    </div>
  );
}

export function ControlModeView(): ReactElement {
  const geometry = useDetailStore((s) => s.geometry);
  const control = useDetailStore((s) => s.control);
  const setControl = useDetailStore((s) => s.setControl);
  const valueField = useDetailStore((s) => s.valueField);
  const timelineFrameIndex = useDetailStore((s) => s.timelineFrameIndex);

  // 기본값 에너지 최적화(01-functional-spec.md 4.4).
  const [target, setTarget] = useState<ControlTarget>('energy');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchDetailControl(target).then((res) => {
      if (cancelled) return;
      setControl(res);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // 마운트 시(탭 선택) 1회 + target이 바뀔 때(버튼 전환)마다 재요청한다. isLoading(true)는
    // 여기서 동기 호출하지 않는다 — 초기값은 useState(true)로, 버튼 전환은
    // handleTargetChange(이벤트 핸들러)에서 미리 켜 둔다(oxlint react(set-state-in-effect)
    // "이벤트가 원인이면 이벤트 핸들러에서 갱신하라"를 따른 구조).
  }, [target, setControl]);

  function handleTargetChange(next: ControlTarget): void {
    // 같은 target을 다시 눌렀을 땐 setTarget이 리렌더를 일으키지 않아 effect가 다시
    // 돌지 않는다 — 그 상태에서 isLoading만 true로 두면 영영 꺼지지 않으므로 먼저 걸러낸다.
    if (next === target) return;
    setIsLoading(true);
    setTarget(next);
  }

  const controlFrames = !isLoading && control && control.status !== 'error' ? control.data.frames : null;
  const isosurfaceCache = useIsosurfaceCache(geometry, controlFrames);

  if (!geometry) {
    return <DetailAreaMessage text="형상 데이터를 불러오는 중입니다..." isError={false} />;
  }

  const frameIndex = controlFrames ? clampTimelineFrameIndex(timelineFrameIndex, controlFrames.length) : 0;
  const frame = controlFrames ? controlFrames[frameIndex] : null;

  return (
    <>
      <ControlTargetToggle target={target} disabled={isLoading} onChange={handleTargetChange} />
      {/* 토글 버튼과 분석 항목 사이 구분선 — ExpertModeView와 같은 패턴(2026-10-11 사용자:
          "분석항목 사이에 라인"). */}
      <div className="h-px shrink-0 bg-ondo-border" />
      <ControlsRow />

      {isLoading ? (
        <EmptyDetail3D geometry={geometry} text="제어 최적화 결과를 계산하는 중입니다..." isError={false} />
      ) : control === null ? (
        <EmptyDetail3D geometry={geometry} text="제어 결과를 불러오는 중입니다..." isError={false} />
      ) : control.status === 'error' ? (
        <EmptyDetail3D geometry={geometry} text={control.error.message} isError />
      ) : !frame ? (
        <EmptyDetail3D geometry={geometry} text="응답에 표시할 프레임이 없습니다." isError />
      ) : (
        <>
          <TimelineSection frames={control.data.frames} />
          <Detail3DSection>
            <Detail3DView
              geometry={geometry}
              frame={frame}
              range={control.data.range}
              overlay={
                valueField === 'flow' ? (
                  <FlowVisualization geometry={geometry} frame={frame} range={control.data.range.flow} />
                ) : (
                  <IsosurfaceVolume
                    geometry={geometry}
                    range={control.data.range}
                    valueField={valueField}
                    frameCache={isosurfaceCache.getFrame(frameIndex)}
                  />
                )
              }
              htmlOverlay={<ControlSummaryCard frames={control.data.frames} control={control.data.control} frameIndex={frameIndex} />}
            />
          </Detail3DSection>
          <Detail2DBox>
            <Detail2DSection geometry={geometry} frame={frame} range={control.data.range} />
          </Detail2DBox>
        </>
      )}
    </>
  );
}
