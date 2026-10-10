// 상세 패널 카드 안 공통 섹션(docs/06-design-guide.md "상세 패널") — 제목 줄 + 내용 박스.
// 네 모드(DetailPanel·ForecastDetailView·ExpertModeView·ControlModeView)가 같은 틀을 쓴다.
import type { ReactElement, ReactNode } from 'react';
import { History } from 'lucide-react';
import type { DetailFrame } from '@ondo/shared';
import { useDetailStore } from '../../store/detailStore.js';
import { Timeline } from './Timeline.js';

/** 상세 패널 스크롤 영역 — "3D 자돈방"부터 "2D 수평단면"까지만 스크롤되고, 그 위의
 * 분석 항목·시간 설정·전문가 입력폼·제어 토글 같은 버튼류는 스크롤 밖에 고정된다
 * (2026-10-11 사용자: "상세보기 패널 스크롤은 3d구역부터 2d까지만이고 위에 설정하고
 * 클릭하는 버튼들은 스크롤 영역에 안들어가고 고정이야"). 네 모드(DetailPanel·
 * ForecastDetailView·ExpertModeView·ControlModeView) 전부 이 컴포넌트로 3D/2D(또는 로딩·
 * 오류 자리표시자) 부분만 감싼다.
 *
 * overflow-y만 auto로 두면 overflow-x가 'visible'에서 'auto'로 강제 계산되는 CSS 규칙
 * 때문에(두 축 중 하나라도 visible이 아니면 다른 축의 visible도 auto로 바뀐다) 2D 단면
 * 내부 몇 px 오차만으로도 가로 스크롤바가 떴다(2026-10-11 사용자: "가로 스크롤없어") —
 * overflow-x-hidden으로 막는다.
 *
 * 스크롤바~카드 배경 간격은 5px(Figma 실측), 3D/2D 콘텐츠는 스크롤바에 바로 붙는다
 * (2026-10-11 사용자: "스크롤과 3d영역이 붙어있어 ... 스크롤옆 상세패널과에 패딩이
 * 5야"). 카드 자체는 p-5(20px 균일)를 유지해야 분석 항목 등 고정 버튼 줄이 그대로
 * 정렬되므로, 이 스크롤 영역만 -mr-[15px]로 카드 패딩 안쪽을 파고들어(20-15=5) 스크롤바를
 * 5px 지점까지 옮긴다 — Detail3DSection 너비(728+15=743)도 같이 넓혀야 내용이 다시
 * 스크롤바에 붙는다. */
export function DetailScrollBody({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="ondo-scrollbar -mr-[15px] flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden">
      {children}
    </div>
  );
}

/** 포인트 on/off(11·16·23·30, 기본 on) — 초록 점 + 토글 스위치. */
function PointsToggle(): ReactElement {
  const pointsVisible = useDetailStore((s) => s.pointsVisible);
  const setPointsVisible = useDetailStore((s) => s.setPointsVisible);

  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-white">
      {/* 점 바깥지름 8px(흰 테두리 1px) + 안쪽 채움 6px — 02_예측모드_디자인_04 실측
          (2026-10-10, "포인트 표시 앞에 원 테두리 디자인 시안엔 있고"). */}
      <span
        className={`h-2 w-2 rounded-full border border-white ${pointsVisible ? 'bg-ondo-accent-on' : 'bg-ondo-muted'}`}
      />
      포인트 표시
      <input
        type="checkbox"
        role="switch"
        checked={pointsVisible}
        onChange={(e) => setPointsVisible(e.target.checked)}
        className="peer sr-only"
      />
      {/* 트랙 46×24(테두리 rgba(85,85,85,0.3) 포함), 손잡이 16×16, 바깥 여백 4px — Figma node
          374:25487(03_전문가모드_디자인_01, 2026-10-10 재확인본) 실측값. absolute 자식의
          top/left는 테두리를 뺀 안쪽(padding) 기준으로 계산되므로, 테두리 1px만큼 뺀
          3px를 써야 바깥 기준 4px 여백이 맞는다(사용자 확인: "토글 흰색원 중심 안맞아보여"). */}
      <span className="relative ml-2 h-6 w-[46px] rounded-full border border-[rgba(85,85,85,0.3)] bg-ondo-border transition-colors peer-checked:bg-ondo-accent-on after:absolute after:left-[3px] after:top-[3px] after:h-[16px] after:w-[16px] after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-[22px]" />
    </label>
  );
}

function SectionTitle({ title, right }: { title: string; right?: ReactNode }): ReactElement {
  return (
    <div className="flex h-6 shrink-0 items-center justify-between">
      <span className="text-[16px] font-semibold text-[#ccc]">{title}</span>
      {right}
    </div>
  );
}

/** "3D 자돈방"(12·18·25·32) 제목 줄(포인트 토글 포함) + 3D 뷰 박스. 기본 728×424에 +15
 * (DetailScrollBody의 -mr-[15px]만큼)를 더해 743×424 — 스크롤바가 5px 지점으로 옮겨간
 * 만큼 내용도 넓혀야 스크롤바에 다시 붙는다(DetailScrollBody 주석 참고). */
export function Detail3DSection({ children }: { children: ReactNode }): ReactElement {
  return (
    <section className="flex shrink-0 flex-col gap-3">
      <SectionTitle title="3D 자돈방" right={<PointsToggle />} />
      <div className="h-[424px] w-[743px]">{children}</div>
    </section>
  );
}

/** "2D 수평단면"(13·19·26·33) 제목 줄 + 단면 박스. */
export function Detail2DBox({ children }: { children: ReactNode }): ReactElement {
  return (
    <section className="flex shrink-0 flex-col gap-3">
      <SectionTitle title="2D 수평단면" />
      <div className="h-[240px]">{children}</div>
    </section>
  );
}

/** "시간 설정"(17·24·31) 제목 줄 + 타임라인, 아래 구분선. 제목 줄 구성(왼쪽부터): 제목 +
 * 안내 아이콘(호버 시 "10분 단위" 표시) + (오른쪽 끝) "초기화" — 02_예측모드_디자인_04
 * 실측(2026-10-10, docs/design/UI), 안내 아이콘·호버 동작은 2026-10-11 사용자 지시(아이콘
 * icons/control/info.png 18×18, "호버시 10분 단위 ui 보이게"). "초기화"는 옛 "정지" 버튼이
 * 이름만 바뀐 것(기능은 그대로 stop(): 첫 프레임으로 되돌리고 멈춤). 예측·전문가·제어 세
 * 모드 전부 같은 디자인(사용자 확인). */
export function TimelineSection({ frames }: { frames: readonly DetailFrame[] }): ReactElement {
  const stop = useDetailStore((s) => s.stop);
  return (
    <section className="flex shrink-0 flex-col gap-3 border-b border-ondo-border pb-5">
      {/* "시간 설정" 글씨-info 아이콘 갭 6px(2026-10-11 사용자 지시) — 뒤 "초기화" 버튼은
          ml-auto로 밀려나므로 이 gap-1.5가 실질적으로 둘 사이에만 적용된다. */}
      <div className="flex h-6 shrink-0 items-center gap-1.5">
        <span className="text-[16px] font-semibold text-[#ccc]">시간 설정</span>
        <div className="group relative flex h-[18px] w-[18px] shrink-0 items-center justify-center">
          <img src="/assets/icons/control/info.png" alt="" width={18} height={18} />
          {/* 아이콘 옆(오른쪽)에 갭 4px로 — 2026-10-11 사용자 정정: "info호버시 나오는
              10분단위 위치는 옆이여야지 아이콘과 갭 4로 해서". */}
          <span className="pointer-events-none absolute left-full top-1/2 z-10 ml-1 -translate-y-1/2 whitespace-nowrap rounded bg-[#474748] px-2 py-0.5 text-xs text-white/80 opacity-0 transition-opacity group-hover:opacity-100">
            10분 단위
          </span>
        </div>
        <button
          type="button"
          onClick={stop}
          className="ml-auto flex items-center gap-1 text-sm font-medium text-[#a4abb5] transition-colors hover:text-white"
        >
          <History size={20} />
          초기화
        </button>
      </div>
      <Timeline frames={frames} />
    </section>
  );
}
