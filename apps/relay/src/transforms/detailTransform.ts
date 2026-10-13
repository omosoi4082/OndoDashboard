// docs/03-upstream-apis.md 4.2 "중계 서버 변환": 연산 서버 원응답(값은 바꾸지 않음) →
// 시각 +09:00, offsetMin, range 계산, geometryId 부착, 배열 개수 검증(125/2,584/288 —
// 하드코딩하지 않고 config/geometry.ts에서 로드한 Geometry 기준). current는 프레임 1개,
// forecast는 10분 간격 145개(docs/02-relay-api.md 5장).
import type { CurrentDetail, DetailFrame, FlowVec, ForecastDetail, Geometry, MinMax } from '@ondo/shared';
import type { ComputeFrame, ComputeRange } from '../clients/computeClient.js';
import { toKstIso } from '../utils/time.js';

export type DetailTransformResult = { ok: true; data: CurrentDetail } | { ok: false; message: string };
export type ForecastTransformResult = { ok: true; data: ForecastDetail } | { ok: false; message: string };

/**
 * 연산 서버 응답의 `geometryId`가 우리가 보관한 Geometry와 같은지 확인한다(v3부터 응답에
 * 포함). 배열 순서가 이 형상 파일을 따르므로, 다르면 포인트·격자 순서를 신뢰할 수 없다.
 * 응답에 없으면(구버전·합성 생성기) 검사하지 않는다.
 */
function validateGeometryId(responseGeometryId: string | undefined, geometry: Geometry): string | null {
  if (responseGeometryId === undefined) return null;
  if (responseGeometryId === geometry.geometryId) return null;
  return `연산 서버 응답의 geometryId가 보관한 형상과 다릅니다(기대 ${geometry.geometryId}, 받은 값 ${responseGeometryId}).`;
}

function minMaxOf(values: readonly number[]): MinMax {
  if (values.length === 0) return { min: 0, max: 0 };
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

function flowValues(fv: readonly FlowVec[]): number[] {
  return fv.map((f) => f[3]);
}

/** 연산 서버 원프레임 1개의 배열 개수가 Geometry와 맞는지 검증(불일치면 명확한 에러). */
function validateFrameCounts(raw: ComputeFrame, geometry: Geometry): string | null {
  const expectedPoints = geometry.points.length;
  const [gnx, gny, gnz] = geometry.grid.size;
  const expectedGrid = gnx * gny * gnz;
  const [fnx, fny, fnz] = geometry.flowGrid.size;
  const expectedFlow = fnx * fny * fnz;

  if (raw.points.temp.length !== expectedPoints || raw.points.rh.length !== expectedPoints || raw.points.flow.length !== expectedPoints) {
    return `points 배열 개수가 Geometry와 다릅니다(기대 ${expectedPoints}, temp=${raw.points.temp.length} rh=${raw.points.rh.length} flow=${raw.points.flow.length}).`;
  }
  if (raw.grid.temp.length !== expectedGrid || raw.grid.rh.length !== expectedGrid) {
    return `grid 배열 개수가 Geometry와 다릅니다(기대 ${expectedGrid}, temp=${raw.grid.temp.length} rh=${raw.grid.rh.length}).`;
  }
  if (raw.flow.length !== expectedFlow) {
    return `flow 배열 개수가 Geometry와 다릅니다(기대 ${expectedFlow}, 실제 ${raw.flow.length}).`;
  }
  return null;
}

/**
 * 연산 서버 응답(current, 프레임 1개) → CurrentDetail. computeFrames는 ComputeClient가
 * 돌려준 원형(시각에 타임존 없음)이며, 값 자체는 바꾸지 않고 포장만 바꾼다.
 */
export function buildCurrentDetail(args: {
  computeFrames: ComputeFrame[];
  modelVersion: string;
  geometry: Geometry;
  /** 연산 서버 응답의 range(v3부터). 있으면 그대로 쓰고, 없으면 프레임에서 계산한다. */
  responseRange?: ComputeRange | undefined;
  /** 연산 서버 응답의 geometryId(v3부터). 있으면 보관한 형상과 일치해야 한다. */
  responseGeometryId?: string | undefined;
}): DetailTransformResult {
  const { computeFrames, modelVersion, geometry, responseRange, responseGeometryId } = args;

  const geometryIdError = validateGeometryId(responseGeometryId, geometry);
  if (geometryIdError) return { ok: false, message: geometryIdError };

  if (computeFrames.length !== 1) {
    return {
      ok: false,
      message: `연산 서버 응답 프레임 수가 올바르지 않습니다(current는 1개 기대, 실제 ${computeFrames.length}).`,
    };
  }
  const raw = computeFrames[0];
  if (!raw) {
    return { ok: false, message: '연산 서버 응답에 프레임이 없습니다.' };
  }

  const countError = validateFrameCounts(raw, geometry);
  if (countError) return { ok: false, message: countError };

  const frame: DetailFrame = {
    offsetMin: 0, // current는 프레임 1개(docs/02-relay-api.md 5장)
    time: toKstIso(raw.time),
    points: raw.points,
    grid: raw.grid,
    flow: raw.flow,
    outdoor: raw.outdoor,
    summary: raw.summary,
    quality: raw.quality,
  };

  // 응답의 range를 그대로 쓴다(v3부터). 없을 때만 프레임에서 계산한다 — ComputeRange
  // 주석 참고(특히 flow는 95퍼센타일이라 우리가 계산하면 색이 뭉개진다).
  const range =
    responseRange ??
    {
      temp: minMaxOf([...frame.points.temp, ...frame.grid.temp]),
      rh: minMaxOf([...frame.points.rh, ...frame.grid.rh]),
      flow: minMaxOf([...flowValues(frame.points.flow), ...flowValues(frame.flow)]),
    };

  const data: CurrentDetail = {
    mode: 'current',
    baseAt: frame.time,
    intervalMin: 10,
    geometryId: geometry.geometryId,
    model_version: modelVersion,
    range,
    frames: [frame],
  };

  return { ok: true, data };
}

// docs/02-relay-api.md 5장 "forecast·expert·control: 10분 간격 145개(0~1,440분)".
const FORECAST_FRAME_COUNT = 145;
const FORECAST_INTERVAL_MIN = 10;

/** 응답에 range가 없을 때(구버전 목업·합성 생성기) 쓰는 폴백 — 전체 프레임 기준 min/max. */
function computeRangeFromFrames(frames: readonly DetailFrame[]): ComputeRange {
  const allTemp: number[] = [];
  const allRh: number[] = [];
  const allFlow: number[] = [];
  for (const f of frames) {
    allTemp.push(...f.points.temp, ...f.grid.temp);
    allRh.push(...f.points.rh, ...f.grid.rh);
    allFlow.push(...flowValues(f.points.flow), ...flowValues(f.flow));
  }
  return { temp: minMaxOf(allTemp), rh: minMaxOf(allRh), flow: minMaxOf(allFlow) };
}

/**
 * 연산 서버 응답(forecast, 프레임 145개) → ForecastDetail. computeFrames는 ComputeClient가
 * 돌려준 원형(마지막 실측 시각부터 10분 간격, 시각에 타임존 없음)이며, 값 자체는 바꾸지 않고
 * 포장만 바꾼다(+09:00, offsetMin=index*10, geometryId, 전체 프레임 기준 range).
 */
export function buildForecastDetail(args: {
  computeFrames: ComputeFrame[];
  modelVersion: string;
  geometry: Geometry;
  /** 연산 서버 응답의 range(v3부터). 있으면 그대로 쓰고, 없으면 145프레임 전체에서 계산한다. */
  responseRange?: ComputeRange | undefined;
  /** 연산 서버 응답의 geometryId(v3부터). 있으면 보관한 형상과 일치해야 한다. */
  responseGeometryId?: string | undefined;
}): ForecastTransformResult {
  const { computeFrames, modelVersion, geometry, responseRange, responseGeometryId } = args;

  const geometryIdError = validateGeometryId(responseGeometryId, geometry);
  if (geometryIdError) return { ok: false, message: geometryIdError };

  if (computeFrames.length !== FORECAST_FRAME_COUNT) {
    return {
      ok: false,
      message: `연산 서버 응답 프레임 수가 올바르지 않습니다(forecast는 ${FORECAST_FRAME_COUNT}개 기대, 실제 ${computeFrames.length}).`,
    };
  }

  const frames: DetailFrame[] = [];
  for (let i = 0; i < computeFrames.length; i += 1) {
    const raw = computeFrames[i];
    if (!raw) {
      return { ok: false, message: `연산 서버 응답에 ${i}번째 프레임이 없습니다.` };
    }
    const countError = validateFrameCounts(raw, geometry);
    if (countError) return { ok: false, message: `${i}번째 프레임: ${countError}` };

    frames.push({
      offsetMin: i * FORECAST_INTERVAL_MIN,
      time: toKstIso(raw.time),
      points: raw.points,
      grid: raw.grid,
      flow: raw.flow,
      outdoor: raw.outdoor,
      summary: raw.summary,
      quality: raw.quality,
    });
  }

  const firstFrame = frames[0];
  if (!firstFrame) {
    return { ok: false, message: '연산 서버 응답에 프레임이 없습니다.' };
  }

  // range: 응답 값을 그대로 쓴다(v3부터, 이미 전 프레임을 아우르는 범위다). 없을 때만
  // 145개 프레임 전체의 min/max를 계산한다 — 재생 중 색 기준이 바뀌지 않아야 하므로
  // (docs/01-functional-spec.md 3장) 프레임별로 계산하지 않는다.
  const range = responseRange ?? computeRangeFromFrames(frames);

  const data: ForecastDetail = {
    mode: 'forecast',
    baseAt: firstFrame.time,
    intervalMin: 10,
    geometryId: geometry.geometryId,
    model_version: modelVersion,
    range,
    frames,
  };

  return { ok: true, data };
}
