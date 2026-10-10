// 상세 패널 카드 안 공통 섹션(docs/06-design-guide.md "상세 패널") — 제목 줄 + 내용 박스.
// 네 모드(DetailPanel·ForecastDetailView·ExpertModeView·ControlModeView)가 같은 틀을 쓴다.
import type { ReactElement, ReactNode } from 'react';
import { History } from 'lucide-react';
import type { DetailFrame } from '@ondo/shared';
import { useDetailStore } from '../../store/detailStore.js';
import { Timeline } from './Timeline.js';

/** 포인트 on/off(11·16·23·30, 기본 on) — 초록 점 + 토글 스위치. */
function PointsToggle(): ReactElement {
  const pointsVisible = useDetailStore((s) => s.pointsVisible);
  const setPointsVisible = useDetailStore((s) => s.setPointsVisible);

  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-white">
      <span className={`h-1.5 w-1.5 rounded-full ${pointsVisible ? 'bg-ondo-accent-on' : 'bg-ondo-muted'}`} />
      포인트 표시
      <input
        type="checkbox"
        role="switch"
        checked={pointsVisible}
        onChange={(e) => setPointsVisible(e.target.checked)}
        className="peer sr-only"
      />
      {/* 트랙 46×24(테두리 rgba(85,85,85,0.3) 포함), 손잡이 16×16, 여백 4px — Figma node
          374:25487(03_전문가모드_디자인_01, 2026-10-10 재확인본) 실측값. */}
      <span className="relative ml-2 h-6 w-[46px] rounded-full border border-[rgba(85,85,85,0.3)] bg-ondo-border transition-colors peer-checked:bg-ondo-accent-on after:absolute after:left-[4px] after:top-[4px] after:h-[16px] after:w-[16px] after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-[22px]" />
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

/** "초기화" — 옛 "정지" 버튼이 이름만 바뀌어 제목 줄로 옮겨왔다(기능은 그대로 stop():
 * 첫 프레임으로 되돌리고 재생을 멈춘다). 예측·전문가·제어 세 모드 전부 같은 디자인
 * (2026-10-10 Figma node 374:25528 "03_전문가모드_디자인_01" 재확인본, 사용자 확인). */
function TimelineResetButton(): ReactElement {
  const stop = useDetailStore((s) => s.stop);
  return (
    <button
      type="button"
      onClick={stop}
      className="flex items-center gap-1 text-sm font-medium text-[#a4abb5] transition-colors hover:text-white"
    >
      <History size={20} />
      초기화
    </button>
  );
}

/** "시간 설정"(17·24·31) 제목 줄 + 타임라인, 아래 구분선. */
export function TimelineSection({ frames }: { frames: readonly DetailFrame[] }): ReactElement {
  return (
    <section className="flex shrink-0 flex-col gap-3 border-b border-ondo-border pb-5">
      <SectionTitle title="시간 설정" right={<TimelineResetButton />} />
      <Timeline frames={frames} />
    </section>
  );
}
