// 메인 화면 레이아웃 — 1920x1080(16:9) 기준 설계지만, 실제 창 크기에 맞춰 유동적으로
// 채운다(2026-10-09 사용자 요청 — 고정 박스를 비율 유지한 채 축소하면 창 모양에 따라
// 좌우나 상하 어느 한쪽에 여백/잘림이 생겨서, 둘 다 없게 창 전체를 그대로 채우는 방식으로
// 바꿨다). 모바일 대응은 안 한다(CLAUDE.md) — `MIN_VIEWPORT_WIDTH_PX`/`MIN_VIEWPORT_HEIGHT_PX`
// 아래로 작은 창에서만 스크롤 없이 잘리는 걸 허용한다(아래 min-w/min-h).
import type { ReactElement } from 'react';
import { Header } from './components/Header.js';
import { OutdoorPanel } from './components/OutdoorPanel.js';
import { ScaleBar } from './components/ScaleBar.js';
import { DetailPanel } from './components/detail/DetailPanel.js';
import { LoadingOverlay } from './components/LoadingOverlay.js';
import { MainScene } from './scene/MainScene.js';
import { useMainDataPolling } from './hooks/useMainDataPolling.js';
import { useDetailGeometryBootstrap } from './hooks/useDetailGeometryBootstrap.js';
import { useCurrentDetailPolling } from './hooks/useCurrentDetailPolling.js';
import { useForecastDetailOnDemand } from './hooks/useForecastDetailOnDemand.js';
import { useMainStore } from './store/mainStore.js';
import { MIN_VIEWPORT_HEIGHT_PX, MIN_VIEWPORT_WIDTH_PX } from './config/constants.js';

function App(): ReactElement {
  useMainDataPolling();
  useDetailGeometryBootstrap();
  // 상세 진입 시 메인 API들과 동시 호출(docs/04-tasks.md M4) — 이 앱은 상세 패널이 항상
  // 노출돼 있으므로 마운트 시점에 geometry 1회 부트스트랩과 함께 걸어 동시에 시작한다.
  useCurrentDetailPolling();
  // 예측 탭(14~19) 선택 시 1회 호출 — M4의 10분 폴링과 별개 패턴이라 별도 훅(docs/04-tasks.md M5).
  useForecastDetailOnDemand();

  const rooms = useMainStore((s) => s.rooms);
  const weatherKma = useMainStore((s) => s.weatherKma);
  const weatherStation = useMainStore((s) => s.weatherStation);
  const isFirstLoading = rooms === null || weatherKma === null || weatherStation === null;

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-[#0e1116]">
      <div
        className="relative flex h-full w-full flex-col overflow-hidden bg-[#0e1116] text-white"
        style={{ minWidth: MIN_VIEWPORT_WIDTH_PX, minHeight: MIN_VIEWPORT_HEIGHT_PX }}
      >
        <Header />

        <div className="flex flex-1">
          {/* 좌측: 외부환경(3) + 3D 메인 모델링(4) + 정보 판넬(5) + 축척(8) — 화면설계(on-01)대로
              외부환경은 모델링 영역 위에 떠 있는 카드 묶음이다(별도 세로 사이드바가 아님). 가로로
              배치해 모델링이 보이는 공간을 최대한 넓게 둔다(2026-10-09 사용자 요청). */}
          <div className="relative flex flex-1 flex-col">
            <div className="relative flex-1">
              <MainScene />
              <div className="pointer-events-none absolute left-0 top-0 p-3">
                <div className="pointer-events-auto">
                  <OutdoorPanel />
                </div>
              </div>
              {isFirstLoading && <LoadingOverlay />}
            </div>
            <div className="flex justify-end border-t border-white/10 px-4 py-2">
              <ScaleBar />
            </div>
          </div>

          {/* 우측: 상세보기 패널(6) — 항상 노출 */}
          <div className="w-[480px]">
            <DetailPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
