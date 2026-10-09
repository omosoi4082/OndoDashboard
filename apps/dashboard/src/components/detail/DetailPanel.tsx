// 상세보기 패널(6) — 01-functional-spec.md 3장 "상세 패널 공통". 네 탭(현재·예측·전문가·
// 제어) 모두 M6까지 실제 내용이 있다.
//
// "현재" 탭은 GET /api/detail/current(M4) 응답을 store(detailStore.current)에서 읽는다.
// 센서 결측이 심하면 relay가 ApiError(source:'sensor')를 돌려줄 수 있다(05-open-questions.md
// #26·#30) — 이때는 3D/2D 영역에 에러 메시지를 그대로 보여준다(로딩도 빈 화면도 아님).
// "예측" 탭은 ForecastDetailView.tsx(GET /api/detail/forecast, 탭 선택 시 1회),
// "전문가" 탭은 ExpertModeView.tsx(확인 클릭 시), "제어" 탭은 ControlModeView.tsx(탭 선택 +
// 최적화 버튼 전환 시마다)로 분리했다(M6).
import type { ReactElement } from 'react';
import { useDetailStore } from '../../store/detailStore.js';
import { SHOW_2D_IN_CURRENT } from '../../config/constants.js';
import { ModeTabs } from './ModeTabs.js';
import { ControlsRow } from './ControlsRow.js';
import { Detail3DView } from './Detail3DView.js';
import { Detail2DSection } from './Detail2DSection.js';
import { DetailAreaMessage } from './DetailAreaMessage.js';
import { ForecastDetailView } from './ForecastDetailView.js';
import { ExpertModeView } from './ExpertModeView.js';
import { ControlModeView } from './ControlModeView.js';

export function DetailPanel(): ReactElement {
  const geometry = useDetailStore((s) => s.geometry);
  const mode = useDetailStore((s) => s.mode);
  const current = useDetailStore((s) => s.current);

  return (
    <aside className="flex h-full w-full flex-col gap-3 border-l border-white/10 bg-[#11151c] p-4">
      <ModeTabs />

      {mode === 'forecast' && <ForecastDetailView />}

      {mode === 'expert' && <ExpertModeView />}

      {mode === 'control' && <ControlModeView />}

      {mode === 'current' && (
        <>
          <ControlsRow />
          {!geometry ? (
            <DetailAreaMessage text="형상 데이터를 불러오는 중입니다..." isError={false} />
          ) : current === null ? (
            <DetailAreaMessage text="데이터를 불러오는 중입니다..." isError={false} />
          ) : current.status === 'error' ? (
            <DetailAreaMessage text={current.error.message} isError />
          ) : !current.data.frames[0] ? (
            <DetailAreaMessage text="응답에 표시할 프레임이 없습니다." isError />
          ) : (
            <>
              <div className="h-[340px] shrink-0">
                <Detail3DView geometry={geometry} frame={current.data.frames[0]} range={current.data.range} />
              </div>
              {SHOW_2D_IN_CURRENT && (
                <div className="h-[220px] shrink-0">
                  <Detail2DSection geometry={geometry} frame={current.data.frames[0]} range={current.data.range} />
                </div>
              )}
            </>
          )}
        </>
      )}
    </aside>
  );
}
