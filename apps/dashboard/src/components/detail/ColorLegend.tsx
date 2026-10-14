// 색 범례(그라데이션 막대 + 값 눈금) — 2D 단면(Detail2DSection) 우측과 3D 뷰(Detail3DView)
// 오버레이가 공유한다(2026-10-14 B-8). 둘 다 같은 컬러맵(detail/colormap.ts)과 같은 응답
// range를 쓰므로 범례도 하나여야 한다. 선택된 값 필드(온도·습도·유동)를 따른다.
//
// 3D 오버레이 쪽은 틀이 56×180으로 고정돼 있어(2026-10-14 사용자 지정, 디자인
// docs/design/UI/04_제어모드_디자인_범례추가.png) 막대를 얇게 쓰고 단위를 뺀다 — 시안의
// 눈금도 값만 적혀 있고, 어떤 값인지는 바로 위 "분석 항목"(온도·유동·습도)으로 알 수 있다.
// 2D 단면 쪽은 공간이 넉넉해 기존대로 24px 막대 + 단위 표기를 유지한다.
import { useMemo, type ReactElement } from 'react';
import type { DetailBase } from '@ondo/shared';
import type { ValueField } from '../../store/detailStore.js';
import { niceAxisTicks } from '../../detail/axisTicks.js';
import { legendGradientStops, legendTickTopPct } from '../../detail/colorLegend.js';
import { getFieldRange, getFieldUnit } from '../../detail/pointSelection.js';

interface ColorLegendProps {
  range: DetailBase['range'];
  valueField: ValueField;
  /** 그라데이션 막대 두께(px). 기본 24는 2D 단면 기준(2026-10-10 사용자 지정). */
  barWidthPx?: number;
  /** 눈금 라벨에 단위를 붙일지. 폭이 좁은 3D 오버레이에서는 끈다. */
  showUnit?: boolean;
}

/**
 * 막대 높이는 부모를 따라 늘어난다(items-stretch 부모 안에서 쓰거나, 부모에 높이를 준다).
 * 눈금 라벨은 막대 오른쪽 바깥(left-full)에 그려지므로 부모 쪽에 라벨 폭만큼 여백을 둔다.
 */
export function ColorLegend({ range, valueField, barWidthPx = 24, showUnit = true }: ColorLegendProps): ReactElement {
  const fieldRange = getFieldRange(range, valueField);
  const unit = getFieldUnit(valueField);
  const stops = useMemo(() => legendGradientStops(valueField), [valueField]);
  // 범례 칫수(값) — 최솟값·최댓값만이 아니라 중간 눈금도 보여준다(2026-10-10 사용자 요청:
  // "범례에도 값에 대한 색상이 나오고 치수들이 보여야지").
  const ticks = useMemo(() => niceAxisTicks(fieldRange.min, fieldRange.max, 4), [fieldRange.min, fieldRange.max]);

  return (
    // 범례 두께 기본 24px(2026-10-10 사용자 요청: "범례두께 24로 변경").
    <div
      className="relative my-1 shrink-0 rounded"
      style={{ width: barWidthPx, background: `linear-gradient(to bottom, ${stops})` }}
    >
      {ticks.map((v) => (
        <div
          key={v}
          className="absolute left-full flex -translate-y-1/2 items-center gap-1 pl-1"
          style={{ top: `${legendTickTopPct(v, fieldRange.min, fieldRange.max)}%` }}
        >
          <span className="h-px w-1.5 bg-white/40" />
          <span className="whitespace-nowrap text-[9px] text-white/60">
            {v.toFixed(1)}
            {showUnit ? unit : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
