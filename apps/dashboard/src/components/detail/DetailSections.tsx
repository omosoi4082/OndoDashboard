// 상세 패널 카드 안 공통 섹션(docs/06-design-guide.md "상세 패널") — 제목 줄 + 내용 박스.
// 네 모드(DetailPanel·ForecastDetailView·ExpertModeView·ControlModeView)가 같은 틀을 쓴다.
import type { ReactElement, ReactNode } from 'react';
import { History, Info } from 'lucide-react';
import type { DetailFrame } from '@ondo/shared';
import { useDetailStore } from '../../store/detailStore.js';
import { Timeline } from './Timeline.js';

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

/** "3D 자돈방"(12·18·25·32) 제목 줄(포인트 토글 포함) + 3D 뷰 박스. */
export function Detail3DSection({ children }: { children: ReactNode }): ReactElement {
  return (
    <section className="flex shrink-0 flex-col gap-3">
      <SectionTitle title="3D 자돈방" right={<PointsToggle />} />
      <div className="h-[420px]">{children}</div>
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
 * 안내 아이콘 + "10분 단위" 배지 + (오른쪽 끝) "초기화" — 02_예측모드_디자인_04 실측
 * (2026-10-10, docs/design/UI). "초기화"는 옛 "정지" 버튼이 이름만 바뀐 것(기능은 그대로
 * stop(): 첫 프레임으로 되돌리고 멈춤). 예측·전문가·제어 세 모드 전부 같은 디자인
 * (사용자 확인). */
export function TimelineSection({ frames }: { frames: readonly DetailFrame[] }): ReactElement {
  const stop = useDetailStore((s) => s.stop);
  return (
    <section className="flex shrink-0 flex-col gap-3 border-b border-ondo-border pb-5">
      <div className="flex h-6 shrink-0 items-center gap-2">
        <span className="text-[16px] font-semibold text-[#ccc]">시간 설정</span>
        <Info size={16} className="text-ondo-muted" />
        <span className="rounded bg-[#474748] px-2 py-0.5 text-xs text-white/80">10분 단위</span>
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
