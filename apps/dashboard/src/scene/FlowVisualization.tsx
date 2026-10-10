// 유동 표현 방식 선택 — FLOW_VISUALIZATION_MODE(config/constants.ts, 05-open-questions.md #40)에
// 따라 FlowStreamlines(흐름선) 또는 FlowCylinders(기존 flowGrid 노드별 실린더)를 그린다.
// 호출 측(ForecastDetailView·ExpertModeView·ControlModeView)은 이 컴포넌트 하나만 쓰면 되고,
// 전환은 상수 하나로 끝난다.
import type { ReactElement } from 'react';
import type { DetailFrame, Geometry, MinMax } from '@ondo/shared';
import { FlowCylinders } from './FlowCylinders.js';
import { FlowStreamlines } from './FlowStreamlines.js';
import { FLOW_VISUALIZATION_MODE } from '../config/constants.js';

interface FlowVisualizationProps {
  geometry: Geometry;
  frame: DetailFrame;
  range: MinMax;
}

export function FlowVisualization(props: FlowVisualizationProps): ReactElement {
  return FLOW_VISUALIZATION_MODE === 'streamlines' ? <FlowStreamlines {...props} /> : <FlowCylinders {...props} />;
}
