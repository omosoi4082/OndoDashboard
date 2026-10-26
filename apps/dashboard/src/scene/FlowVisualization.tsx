// 유동 표현 — 입자 애니메이션(scene/FlowParticles.tsx).
// 2026-10-13 온도 측 A-3 확정은 "288개 점의 화살표"였고(05-open-questions.md #40) 그동안
// FlowCylinders(노드마다 화살표 1개)를 썼다. 2026-10-26 온도 측이 참고 샘플처럼 "공기 입자가
// 급기구에서 들어와 배기구로 흘러가는 애니메이션 + 입자 색 온도/습도"를 요청해 입자로 바꿨다.
// 화살표 구현(FlowCylinders.tsx)은 되돌릴 수 있게 남겨 둔다. 호출 측
// (ForecastDetailView·ExpertModeView·ControlModeView)은 이 컴포넌트 하나만 쓴다.
import type { ReactElement } from 'react';
import type { DetailBase, DetailFrame, Geometry } from '@ondo/shared';
import { FlowParticles } from './FlowParticles.js';

interface FlowVisualizationProps {
  geometry: Geometry;
  frame: DetailFrame;
  /** 입자 색은 온도·습도 범위를 쓰므로 flow만이 아니라 range 전체를 받는다. */
  range: DetailBase['range'];
}

export function FlowVisualization(props: FlowVisualizationProps): ReactElement {
  return <FlowParticles {...props} />;
}
