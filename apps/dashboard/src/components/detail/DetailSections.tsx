// 상세 패널 카드 안 공통 섹션(docs/06-design-guide.md "상세 패널") — 제목 줄 + 내용 박스.
// 네 모드(DetailPanel·ForecastDetailView·ExpertModeView·ControlModeView)가 같은 틀을 쓴다.
import type { ReactElement, ReactNode } from 'react';
import { Info } from 'lucide-react';
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
      {/* 트랙 46×24, 손잡이 18×18, 여백 3px — Figma node 374:11805(03_전문가모드) 실측값. */}
      <span className="relative ml-2 h-6 w-[46px] rounded-full bg-ondo-border transition-colors peer-checked:bg-ondo-accent-on after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-[22px]" />
    </label>
  );
}

function SectionTitle({ title, right }: { title: string; right?: ReactNode }): ReactElement {
  return (
    <div className="flex h-6 shrink-0 items-center justify-between">
      <span className="text-sm font-medium text-white">{title}</span>
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

/** "시간 설정"(17·24·31) 제목 줄 + 타임라인, 아래 구분선. */
export function TimelineSection({ frames }: { frames: readonly DetailFrame[] }): ReactElement {
  return (
    <section className="flex shrink-0 flex-col gap-3 border-b border-ondo-border pb-5">
      <SectionTitle
        title="시간 설정"
        right={
          <span className="flex items-center gap-1 text-xs text-ondo-muted">
            <Info size={16} />
            10분 단위
          </span>
        }
      />
      <Timeline frames={frames} />
    </section>
  );
}
