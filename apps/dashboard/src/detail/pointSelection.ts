// 포인트 값 선택 — 유동/습도/온도 토글(10·15·22·29)에 따라 DetailFrame에서 올바른
// 필드를 꺼내는 순수 로직. 컴포넌트(PointsInstanced, Detail3DView 호버 툴팁)에서 분리해
// 테스트한다(CLAUDE.md 코드 규칙).
import type { DetailBase, DetailFrame, FlowVec, MinMax } from '@ondo/shared';
import type { ValueField } from '../store/detailStore.js';

/** 유동 선택 시 VALUE는 유속 크기 value(m/s) — 01-functional-spec.md 3장. */
export function getPointFlow(frame: DetailFrame, pointId: number): FlowVec | null {
  return frame.points.flow[pointId] ?? null;
}

export function getPointScalar(frame: DetailFrame, field: ValueField, pointId: number): number {
  if (field === 'temp') return frame.points.temp[pointId] ?? 0;
  if (field === 'rh') return frame.points.rh[pointId] ?? 0;
  const flow = getPointFlow(frame, pointId);
  return flow ? flow[3] : 0;
}

/** 응답 range에서 토글에 맞는 min/max를 꺼낸다(재생형 모드는 전체 프레임 기준 범위 고정). */
export function getFieldRange(range: DetailBase['range'], field: ValueField): MinMax {
  if (field === 'temp') return range.temp;
  if (field === 'rh') return range.rh;
  return range.flow;
}

export function getFieldUnit(field: ValueField): string {
  if (field === 'temp') return '℃';
  if (field === 'rh') return '%';
  return 'm/s';
}
