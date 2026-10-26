// 위치 표시(기상청 격자 예보구역 이름) — 2026-10-26까지는 헤더 왼쪽에 있었는데, 온도 측
// 추가요청 레이아웃 (2)("3D 모델링이 좀 더 잘 보였으면")에 따라 외부환경(3) 패널과 한 덩어리로
// 좌측 하단으로 내렸다(App.tsx). 기상 정보와 그 위치는 같이 읽히는 게 맞다는 사용자 판단.
// 값은 relay .env의 FARM_AREA_NAME → GET /api/main/weather/kma의 areaName
// (docs/06-design-guide.md "헤더" — 글자 15px, 핀 아이콘 18px은 그대로 유지).
import type { ReactElement } from 'react';
import { LocationPinIcon } from '../icons/designIcons.js';
import { okData } from '../api/client.js';
import { useMainStore } from '../store/mainStore.js';

export function AreaNameLabel(): ReactElement {
  const areaName = okData(useMainStore((s) => s.weatherKma))?.areaName ?? null;

  return (
    // 화면 자동 점검(tests/ui)이 헤더가 아닌 이 자리에서 위치 이름을 찾는 손잡이.
    // 높이는 핀 아이콘과 같은 18px로 고정한다 — 글꼴 기본 줄높이(22.5px)에 맡기면 아래
    // 외부환경 블록과의 간격이 어중간해진다.
    <div
      data-testid="area-name"
      className="flex h-[18px] items-center gap-2.5 text-[15px] leading-none text-white"
    >
      <LocationPinIcon size={18} />
      <span>{areaName ?? '-'}</span>
    </div>
  );
}
