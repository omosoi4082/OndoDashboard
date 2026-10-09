// docs/03-upstream-apis.md 4.4 "전문가·제어 목업": 온도 측 실제 mock_expert.json·
// mock_control_{energy,environment}.json을 받기 전까지, npm run mock:generate가 생성하는
// 결정적(시드 고정) 합성 데이터. mockComputeGen.ts(현재/예측 mock)와 같은 패턴 — Math.random
// 미사용, geometry 개수는 하드코딩하지 않고 Geometry에서 읽는다.
//
// 설계(docs/05-open-questions.md #24·#25·#27·#28 참고):
// - expert: 145프레임, input 필드는 라우트가 요청값으로 덮어쓸 placeholder(여기서는 임의값).
// - control: 145프레임은 "최적화(optimized)" 운영 시나리오를 3D/2D로 보여주는 데이터로 쓰고,
//   baseline은 control 블록(요약 카드+그래프, C안) 계산에만 쓰인다 — 별도 3D 프레임 없음.
// - energy/environment 두 target은 fanPct 감쇠(dip) 폭과 tMeanMax 제약을 다르게 둬 energy가
//   더 큰 절감률, environment가 더 낮은 절감률+더 쾌적(그럴듯하게만, 정교함 불필요).
import type { ComputeFrame, ComputeRequestInput } from '../clients/computeClient.js';
import type { ControlBlock, ControlDetail, ExpertDetail, Geometry } from '@ondo/shared';
import { generateMockFrame } from './mockComputeGen.js';
import { wrapControlDetail, wrapExpertDetail } from './detailWrap.js';
import { formatKstWallClockNaive } from '../utils/time.js';

export const MOCK_EXPERT_CONTROL_MODEL_VERSION = 'mock-v1';
// docs/02-relay-api.md 5장: forecast·expert·control 모두 10분 간격 145개(0~1,440분).
export const EXPERT_CONTROL_FRAME_COUNT = 145;
const FRAME_INTERVAL_MIN = 10;
const MINUTE_MS = 60_000;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** frameIndex(0~frameCount-1) → 생성 시각(naive KST). baseTime도 같은 표현(kstWallClock류)이어야 한다. */
export function frameTimeAt(baseTime: Date, frameIndex: number): string {
  return formatKstWallClockNaive(new Date(baseTime.getTime() + frameIndex * FRAME_INTERVAL_MIN * MINUTE_MS));
}

export interface DayCycleConfig {
  tOutBase: number;
  tOutAmplitude: number;
  rhOutBase: number;
  rhOutAmplitude: number;
}

/**
 * 24시간 외기 온습도 사인파(결정적) — frameIndex=0(자정 가정)에서 최저, frameCount/2(정오
 * 부근)에서 최고. 실제 발표 시각과 무관한 합성 데이터이므로 위상은 "그럴듯한 하루 변화 모양"
 * 용도일 뿐이다. 온도와 습도는 반대로 움직이게 한다(한낮에 덥고 건조).
 */
export function dayCycleOutdoor(
  frameIndex: number,
  frameCount: number,
  cfg: DayCycleConfig,
): { T_out: number; RH_out: number } {
  const angle = (2 * Math.PI * frameIndex) / frameCount - Math.PI / 2;
  const T_out = cfg.tOutBase + cfg.tOutAmplitude * Math.sin(angle);
  const RH_out = clamp(cfg.rhOutBase - cfg.rhOutAmplitude * Math.sin(angle), 0, 100);
  return { T_out, RH_out };
}

export interface FanBellConfig {
  min: number;
  max: number;
}

/** 완만한 종 모양 환기량 곡선(0~frameCount-1에서 가장자리 min, 중앙 max). */
export function fanBellCurve(frameIndex: number, frameCount: number, cfg: FanBellConfig): number {
  const fraction = frameIndex / Math.max(frameCount - 1, 1);
  const bell = Math.sin(Math.PI * fraction); // 0(가장자리) ~ 1(중앙)
  return cfg.min + (cfg.max - cfg.min) * bell;
}

export interface FanDipConfig {
  centerFrac: number; // 0~1, dip 중심 위치
  widthFrac: number; // 0~1, dip 폭(가우시안 표준편차 비율)
  amplitude: number; // dip 최대 깊이(%p)
}

/** 중간 구간에서 더 낮게 꺾이는 가우시안 dip(05-open-questions.md #28 레퍼런스 설명). */
export function fanDip(frameIndex: number, frameCount: number, cfg: FanDipConfig): number {
  const lastIdx = Math.max(frameCount - 1, 1);
  const centerIdx = cfg.centerFrac * lastIdx;
  const widthIdx = Math.max(cfg.widthFrac * lastIdx, 1e-6);
  const d = (frameIndex - centerIdx) / widthIdx;
  return cfg.amplitude * Math.exp(-0.5 * d * d);
}

/** 팬 전력(kW) — 널리 쓰는 "팬 전력 ∝ 회전속도(가동률)의 3승" 근사(팬 법칙). */
export function fanPowerKw(fanPct: number, ratedKw: number): number {
  return ratedKw * (fanPct / 100) ** 3;
}

export interface ControlGenOptions {
  dayCycle: DayCycleConfig;
  fanBaseline: FanBellConfig;
  dip: FanDipConfig;
  tMeanMaxConstraint: number;
  fanRatedKw: number;
}

export interface ControlSeriesResult {
  frames: ComputeFrame[]; // optimized 시나리오(3D/2D 표시용)
  control: ControlBlock;
}

/**
 * baseline(현재 운영 가정) vs optimized(최적화) 두 환기량 시나리오를 생성하고, optimized
 * 시나리오로 3D/2D 프레임(frames)과 control 블록(baseline·optimized 비교 통계)을 만든다.
 * 결정적(시드 고정, Math.random 미사용) — generateMockFrame과 같은 원칙.
 */
export function buildControlSeries(geometry: Geometry, baseTime: Date, opts: ControlGenOptions): ControlSeriesResult {
  const baselineFanPct: number[] = [];
  const optimizedFanPct: number[] = [];
  const baselineTMean: number[] = [];
  const optimizedTMean: number[] = [];
  const optimizedFrames: ComputeFrame[] = [];

  let baselineTMax = -Infinity;
  let optimizedTMax = -Infinity;
  let baselineKwh = 0;
  let optimizedKwh = 0;
  const hoursPerFrame = FRAME_INTERVAL_MIN / 60;

  for (let i = 0; i < EXPERT_CONTROL_FRAME_COUNT; i += 1) {
    const time = frameTimeAt(baseTime, i);
    const { T_out, RH_out } = dayCycleOutdoor(i, EXPERT_CONTROL_FRAME_COUNT, opts.dayCycle);
    const basePct = fanBellCurve(i, EXPERT_CONTROL_FRAME_COUNT, opts.fanBaseline);
    const dip = fanDip(i, EXPERT_CONTROL_FRAME_COUNT, opts.dip);
    const optPct = clamp(basePct - dip, opts.fanBaseline.min, opts.fanBaseline.max);

    baselineFanPct.push(round1(basePct));
    optimizedFanPct.push(round1(optPct));

    const baselineInput: ComputeRequestInput = { time, T_out, RH_out, fan_pct: basePct };
    const optimizedInput: ComputeRequestInput = { time, T_out, RH_out, fan_pct: optPct };
    const baselineFrame = generateMockFrame(baselineInput, geometry);
    const optimizedFrame = generateMockFrame(optimizedInput, geometry);

    baselineTMean.push(round1(baselineFrame.summary.T_mean));
    optimizedTMean.push(round1(optimizedFrame.summary.T_mean));
    baselineTMax = Math.max(baselineTMax, baselineFrame.summary.T_max);
    optimizedTMax = Math.max(optimizedTMax, optimizedFrame.summary.T_max);

    baselineKwh += fanPowerKw(basePct, opts.fanRatedKw) * hoursPerFrame;
    optimizedKwh += fanPowerKw(optPct, opts.fanRatedKw) * hoursPerFrame;

    optimizedFrames.push(optimizedFrame);
  }

  const savingPct = baselineKwh > 0 ? ((baselineKwh - optimizedKwh) / baselineKwh) * 100 : 0;

  const control: ControlBlock = {
    baselineFanPct,
    optimizedFanPct,
    baselineTMean,
    optimizedTMean,
    energyKwh: { baseline: round1(baselineKwh), optimized: round1(optimizedKwh) },
    savingPct: round1(savingPct),
    tMax: { baseline: round1(baselineTMax), optimized: round1(optimizedTMax) },
    constraint: { tMeanMax: opts.tMeanMaxConstraint },
  };

  return { frames: optimizedFrames, control };
}

export interface ExpertGenOptions {
  dayCycle: DayCycleConfig;
  fan: FanBellConfig;
}

/** 전문가 모드 목업 프레임(145개) — 입력값과 무관하게 항상 같은 하루 변화 데이터(05-open-questions #24). */
export function buildExpertSeries(geometry: Geometry, baseTime: Date, opts: ExpertGenOptions): ComputeFrame[] {
  const frames: ComputeFrame[] = [];
  for (let i = 0; i < EXPERT_CONTROL_FRAME_COUNT; i += 1) {
    const time = frameTimeAt(baseTime, i);
    const { T_out, RH_out } = dayCycleOutdoor(i, EXPERT_CONTROL_FRAME_COUNT, opts.dayCycle);
    const fan_pct = fanBellCurve(i, EXPERT_CONTROL_FRAME_COUNT, opts.fan);
    frames.push(generateMockFrame({ time, T_out, RH_out, fan_pct }, geometry));
  }
  return frames;
}

/** buildExpertSeries 결과를 ExpertDetail(공통 포장: +09:00·offsetMin·range·geometryId)로 감싼다. */
export function buildExpertDetailMock(
  geometry: Geometry,
  baseTime: Date,
  opts: ExpertGenOptions,
  placeholderInput: { temp: number; rh: number; vent: number },
): ExpertDetail {
  const frames = buildExpertSeries(geometry, baseTime, opts);
  const wrapped = wrapExpertDetail({ frames, modelVersion: MOCK_EXPERT_CONTROL_MODEL_VERSION, geometry, input: placeholderInput });
  if (!wrapped.ok) {
    throw new Error(`전문가 모드 목업 생성 실패: ${wrapped.message}`);
  }
  return wrapped.data;
}

/** buildControlSeries 결과를 ControlDetail(공통 포장)로 감싼다. */
export function buildControlDetailMock(
  geometry: Geometry,
  baseTime: Date,
  target: 'energy' | 'environment',
  opts: ControlGenOptions,
): ControlDetail {
  const { frames, control } = buildControlSeries(geometry, baseTime, opts);
  const wrapped = wrapControlDetail({ frames, modelVersion: MOCK_EXPERT_CONTROL_MODEL_VERSION, geometry, target, control });
  if (!wrapped.ok) {
    throw new Error(`제어 모드(${target}) 목업 생성 실패: ${wrapped.message}`);
  }
  return wrapped.data;
}
