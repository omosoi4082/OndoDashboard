// 유동 표현 — flowGrid 노드마다 화살표 1개(scene/FlowCylinders.tsx).
// 2026-10-13 온도 측 A-3 확정: "288개 점의 화살표로 표현해 주시면 됩니다. 참고 HTML 같은
// 흐름선(스트림튜브) 추적은 필요하지 않습니다"(05-open-questions.md #40).
// 한때 흐름선(FlowStreamlines) 구현과 FLOW_VISUALIZATION_MODE 상수로 전환하게 두었으나,
// 확정 뒤로 쓰이지 않아 2026-10-17 사용자 확인 후 삭제했다. 호출 측
// (ForecastDetailView·ExpertModeView·ControlModeView)은 이 컴포넌트 하나만 쓴다.
import type { ReactElement } from 'react';
import type { DetailFrame, Geometry, MinMax } from '@ondo/shared';
import { FlowCylinders } from './FlowCylinders.js';

interface FlowVisualizationProps {
  geometry: Geometry;
  frame: DetailFrame;
  range: MinMax;
}

export function FlowVisualization(props: FlowVisualizationProps): ReactElement {
  return <FlowCylinders {...props} />;
}
