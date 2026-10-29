// 상단 헤더 — 로고(1) + 날짜·요일·시간(2). 01-functional-spec.md 2장,
// 스타일은 docs/06-design-guide.md "헤더". 로고는 docs/design/logo/로고-light.svg 복사본.
// 위치(기상청 동네 이름)는 2026-10-26까지 여기 왼쪽에 있었는데, 3D 모델링을 더 크게 보여
// 달라는 요청(온도 추가요청 레이아웃 (2))으로 외부환경(3) 패널과 함께 좌측 하단으로 내렸다
// — components/AreaNameLabel.tsx, 배치는 App.tsx. 로고는 absolute left-1/2로 가운데 고정이고
// 날짜·시각만 남아 오른쪽 정렬(justify-end)로 바꿨다.
// 높이는 2026-10-26 사용자 지시로 74 → 56px. 로고(42px)·날짜가 items-center라 위아래 여백이
// 반씩 줄어(16 → 7px), 로고 위 여백과 "날짜 ↔ 모드 탭" 간격이 한 번에 줄어든다 — 상세 패널
// 컨테이너(App.tsx)에 위쪽 패딩이 없어서 모드 탭은 헤더가 끝나는 지점에서 바로 시작한다.
// 줄어든 18px은 그대로 상세 패널 세로 공간이 된다(3D를 더 크게 보이게).
// 높이를 config/constants.ts로 빼지 않고 여기 두는 건 의도다 — 이 값을 쓰는 곳이 여기뿐이다.
import { useEffect, useState, type ReactElement } from 'react';
import { CLOCK_TICK_INTERVAL_MS } from '../config/constants.js';
import { formatHeaderDate, formatHeaderTime, formatHeaderWeekday } from '../utils/formatDateTime.js';

export function Header(): ReactElement {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="pointer-events-none relative flex h-[56px] shrink-0 items-center justify-end px-[42px]">
      <img src="/assets/logo/logo-light.svg" alt="온도" className="absolute left-1/2 h-[42px] -translate-x-1/2" />
      {/* 날짜·요일·시각 각각 별도 칸, 전부 SemiBold(Figma node 307:10016~10019,
          2026-10-10 재확인 — 기존엔 날짜+요일을 한 덩어리로 합치고 간격 18px·날짜만 medium이라
          시안과 달랐음).
          2026-10-29 사용자 지시로 이 덩어리 전체를 **10% 축소 두 번**(원래의 81% — 한 번으로는
          "티가 안 난다"). 글자·자간·간격을 같은 비율로 줄여 시안의 비례를 유지한다
          (16 → 13px, 22 → 17.8px, 간격 12 → 9.7px). 헤더 높이 56px와 로고는 그대로다. */}
      <div className="flex items-center gap-[9.7px] tabular-nums text-white">
        <span className="text-[13px] font-semibold tracking-[-0.26px]">{formatHeaderDate(now)}</span>
        <span className="text-[13px] font-semibold tracking-[-0.26px]">{formatHeaderWeekday(now)}</span>
        <time className="text-[17.8px] font-semibold tracking-[1.07px]">{formatHeaderTime(now)}</time>
      </div>
    </header>
  );
}
