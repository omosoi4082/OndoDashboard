// 메인 화면 레이아웃 — 1920x1080(16:9) 기준 설계지만, 실제 창 크기에 맞춰 유동적으로
// 채운다(2026-10-09 사용자 요청 — 고정 박스를 비율 유지한 채 축소하면 창 모양에 따라
// 좌우나 상하 어느 한쪽에 여백/잘림이 생겨서, 둘 다 없게 창 전체를 그대로 채우는 방식으로
// 바꿨다). 모바일 대응은 안 한다(CLAUDE.md) — `MIN_VIEWPORT_WIDTH_PX`/`MIN_VIEWPORT_HEIGHT_PX`
// 아래로 작은 창에서만 스크롤 없이 잘리는 걸 허용한다(아래 min-w/min-h).
import type { ReactElement } from 'react';
import { AreaNameLabel } from './components/AreaNameLabel.js';
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
import {
  DETAIL_PANEL_WIDTH_PX,
  MAIN_SCENE_HEIGHT_PX,
  MAIN_SCENE_TOP_PX,
  MAIN_SCENE_WIDTH_PX,
  MIN_VIEWPORT_HEIGHT_PX,
  MIN_VIEWPORT_WIDTH_PX,
  OUTDOOR_CLUSTER_SCALE,
} from './config/constants.js';

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
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-[#1b1a1f]">
      <div
        className="relative flex h-full w-full flex-col overflow-hidden bg-[#1b1a1f] text-white"
        style={{ minWidth: MIN_VIEWPORT_WIDTH_PX, minHeight: MIN_VIEWPORT_HEIGHT_PX }}
      >
        {/* 3D 메인 모델링(4) 배경 레이어 — 헤더·상세 패널 뒤까지 덮는 배경이고 그 위에 패널들이
            얹히는 구조다(2026-10-10 사용자 확정: "모델링 캔버스는 전체 화면이고 그 위에 패널들
            레이어 되는 방식"). 단, 패널들과 달리 이 레이어는 창 크기에 반응하지 않는 고정
            크기다(MAIN_SCENE_WIDTH/HEIGHT_PX, 2026-10-10 사용자 확정 — "패널은 반응형, 캔버스는
            고정"). 리사이즈마다 카메라 비율을 다시 계산하면 setViewOffset 계산이 복잡해지고
            자칫 찌그러지는데, 애초에 안 바뀌면 그 문제 자체가 없다. pointer-events-none이라
            클릭/드래그는 OutdoorPanel처럼 안에서 다시 auto로 켠 요소만 받고, 나머지는 이
            레이어(캔버스)까지 그대로 통과해 OrbitControls가 받는다 — 이 레이어 자체는
            pointer-events를 꺼두면 안 된다(껐더니 OrbitControls가 죽었음, 자식 요소까지
            상속되는 속성이라).
            isolate(= isolation: isolate)는 이 레이어 안에서 쓰는 z-index를 바깥과 섞이지 않게
            가둔다 — drei <Html>(방 이름표·정보 판넬)이 z-index 16777271을 달고 나와서 헤더와
            상세 패널까지 덮었다(2026-10-14 사용자: "ui 순번 아래로 상세패널이 먼저 보여야 돼").
            이 레이어가 DOM에서 헤더·상세 패널보다 앞이라, 가둬 두면 그 둘이 항상 위에 온다. */}
        {/* data-testid는 화면 자동 점검(tests/ui)이 이 레이어 안의 방 이름표·정보 카드를
            찾는 고정 손잡이다 — 클래스 이름에 기대면 스타일을 손볼 때마다 테스트가 깨진다. */}
        <div
          data-testid="main-scene"
          className="absolute left-0 top-0 isolate"
          style={{ width: MAIN_SCENE_WIDTH_PX, height: MAIN_SCENE_HEIGHT_PX, top: MAIN_SCENE_TOP_PX }}
        >
          <MainScene />
        </div>

        <Header />

        {/* pointer-events-none을 row에 직접 줘야 한다 — leftcol에만 줬더니 투명한 row 자신이
            히트테스트에 걸려서 캔버스까지 이벤트가 안 내려갔다(2026-10-10, 사용자가 본문 3D
            영역 드래그가 안 된다고 확인해줌). 오른쪽 상세 패널은 캔버스와 안 겹치니 다시
            pointer-events-auto로 켠다. */}
        <div className="pointer-events-none relative flex min-h-0 flex-1">
          {/* 좌측: 외부환경(3) + 정보 판넬(5) + 축척(8) — 모델링은 위로 뺀 배경 레이어가 맡고,
              여긴 그 위에 얹는 오버레이만 남는다(화면설계 on-01대로 가로 배치,
              2026-10-09 사용자 요청). */}
          <div className="relative flex flex-1 flex-col">
            <div className="relative flex-1">
              {/* 축척(8) — 좌측 영역의 오른쪽 아래, 상세 패널 바로 왼쪽(2026-10-26 사용자
                  지시로 왼쪽 아래 → 오른쪽 아래. 외부환경 묶음이 왼쪽 아래로 내려와서 자리를
                  비켜줬다. docs/06-design-guide.md도 같이 고쳤다).
                  축척은 줄이지 않는다 — 막대 길이가 카메라 줌에서 계산된 실제 거리라
                  축소하면 눈금이 틀어진다. */}
              <div className="absolute bottom-6 right-6">
                <ScaleBar />
              </div>
              {/* 위치 이름 + 외부환경(3) 묶음 — 좌측 하단(왼쪽 40px·아래 24px).
                  원래 외부환경은 왼쪽 위, 위치 이름은 헤더 왼쪽이었는데 3D 모델링을 더 크게
                  보여 달라는 요청으로 우선순위가 낮은 이 정보를 아래로 내리고 80%로 줄였다
                  (2026-10-26 온도 추가요청 레이아웃 (2)).
                  축소는 OutdoorPanel 내부 치수(Figma 실측값)를 건드리지 않게 바깥에서 한 번에
                  하고, transformOrigin을 bottom left로 둬서 이 모서리에 붙은 채 줄어든다. */}
              <div
                className="absolute bottom-6 left-10"
                style={{
                  transform: `scale(${OUTDOOR_CLUSTER_SCALE})`,
                  transformOrigin: 'bottom left',
                }}
              >
                <div className="pointer-events-auto flex flex-col gap-[14px]">
                  <AreaNameLabel />
                  <OutdoorPanel />
                </div>
              </div>
              {isFirstLoading && <LoadingOverlay />}
            </div>
          </div>

          {/* 우측: 상세보기 패널(6) — 항상 노출, 가로 768px. 캔버스와 안 겹치니 클릭 정상 작동하게 auto로 복구 */}
          <div className="pointer-events-auto shrink-0 pb-5 pr-5" style={{ width: DETAIL_PANEL_WIDTH_PX }}>
            <DetailPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
