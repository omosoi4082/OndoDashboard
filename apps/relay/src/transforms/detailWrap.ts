// 전문가·제어 모드 공통 포장: ComputeFrame[](연산 서버 원응답 형태, offsetMin 없음·시각
// 타임존 없음) 145개를 받아 buildForecastDetail의 변환(시각 +09:00·offsetMin 부여·range
// 계산(전체 프레임 기준)·geometryId 부착·배열 개수 검증)을 재사용하고, mode·input(expert) 또는
// target·control(control)만 덧붙인다. 실제 mock 파일 로더(mockFileParse.ts)와 합성 생성기
// (mockExpertControlGen.ts) 양쪽에서 함께 쓴다 — frames 출처가 달라도 포장 로직은 하나다.
import type { ControlBlock, ControlDetail, ExpertDetail, Geometry } from '@ondo/shared';
import type { ComputeFrame } from '../clients/computeClient.js';
import { buildForecastDetail } from './detailTransform.js';

export type ExpertWrapResult = { ok: true; data: ExpertDetail } | { ok: false; message: string };
export type ControlWrapResult = { ok: true; data: ControlDetail } | { ok: false; message: string };

export function wrapExpertDetail(args: {
  frames: ComputeFrame[];
  modelVersion: string;
  geometry: Geometry;
  input: { temp: number; rh: number; vent: number };
}): ExpertWrapResult {
  const transformed = buildForecastDetail({ computeFrames: args.frames, modelVersion: args.modelVersion, geometry: args.geometry });
  if (!transformed.ok) return { ok: false, message: transformed.message };
  const base = transformed.data;
  return {
    ok: true,
    data: {
      mode: 'expert',
      baseAt: base.baseAt,
      intervalMin: base.intervalMin,
      geometryId: base.geometryId,
      model_version: base.model_version,
      range: base.range,
      frames: base.frames,
      input: args.input,
    },
  };
}

export function wrapControlDetail(args: {
  frames: ComputeFrame[];
  modelVersion: string;
  geometry: Geometry;
  target: 'energy' | 'environment';
  control: ControlBlock;
}): ControlWrapResult {
  const transformed = buildForecastDetail({ computeFrames: args.frames, modelVersion: args.modelVersion, geometry: args.geometry });
  if (!transformed.ok) return { ok: false, message: transformed.message };
  const base = transformed.data;
  return {
    ok: true,
    data: {
      mode: 'control',
      target: args.target,
      baseAt: base.baseAt,
      intervalMin: base.intervalMin,
      geometryId: base.geometryId,
      model_version: base.model_version,
      range: base.range,
      frames: base.frames,
      control: args.control,
    },
  };
}
