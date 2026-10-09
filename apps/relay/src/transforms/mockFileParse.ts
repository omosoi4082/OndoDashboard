// mock/mock_expert.json·mock/mock_control.json(온도 측 실제 목업 파일, mock/README.md
// "읽는 법" 참고) 파싱. 이 파일들은 "연산 서버 원응답 + 목업 전용 필드"다 — relay가 쓰는
// ComputeFrame[] 모양의 frames는 그대로지만(offsetMin 없음, 시각 타임존 없음), 그 외
// request_id·status·mock·mock_version·note·scenario·guide·최상위 input(연산 서버 요청
// 원본)은 우리 ExpertDetail/ControlDetail 타입에 없으므로 버린다. control 블록은
// snake_case(baseline_fan_pct 등 + fan_rated_kw·power_model)라 packages/shared의
// ControlBlock(camelCase, fan_rated_kw·power_model 없음)으로 매핑한다.
import { z } from 'zod';
import type { ControlBlock } from '@ondo/shared';
import { frameSchema, type ComputeFrame } from '../clients/computeClient.js';

// z.object()는 기본적으로 정의하지 않은 여분 필드를 조용히 무시한다(geometryValidate.ts와
// 같은 원칙) — request_id·status·mock·scenario·guide 등은 그냥 걸러진다.
const rawExpertFileSchema = z.object({
  model_version: z.string().min(1),
  frames: z.array(frameSchema),
});

const rawControlBlockSchema = z.object({
  baseline_fan_pct: z.array(z.number()),
  optimized_fan_pct: z.array(z.number()),
  baseline_T_mean: z.array(z.number()),
  optimized_T_mean: z.array(z.number()),
  energy_kwh: z.object({ baseline: z.number(), optimized: z.number() }),
  saving_pct: z.number(),
  T_max: z.object({ baseline: z.number(), optimized: z.number() }),
  constraint: z.object({ T_mean_max: z.number() }),
  // fan_rated_kw·power_model은 ControlBlock에 없는 필드라 읽지 않고 버린다(zod가 자동 무시).
});

const rawControlFileSchema = z.object({
  model_version: z.string().min(1),
  control: rawControlBlockSchema,
  frames: z.array(frameSchema),
});

export interface ParsedExpertFile {
  modelVersion: string;
  frames: ComputeFrame[];
}

export interface ParsedControlFile {
  modelVersion: string;
  control: ControlBlock;
  frames: ComputeFrame[];
}

export type ExpertFileParseResult = { ok: true; data: ParsedExpertFile } | { ok: false; message: string };
export type ControlFileParseResult = { ok: true; data: ParsedControlFile } | { ok: false; message: string };

export function parseExpertMockFile(json: unknown): ExpertFileParseResult {
  const parsed = rawExpertFileSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, message: `mock_expert.json 형식이 올바르지 않습니다: ${parsed.error.message}` };
  }
  return { ok: true, data: { modelVersion: parsed.data.model_version, frames: parsed.data.frames } };
}

export function parseControlMockFile(json: unknown): ControlFileParseResult {
  const parsed = rawControlFileSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, message: `mock_control.json 형식이 올바르지 않습니다: ${parsed.error.message}` };
  }
  const c = parsed.data.control;
  const control: ControlBlock = {
    baselineFanPct: c.baseline_fan_pct,
    optimizedFanPct: c.optimized_fan_pct,
    baselineTMean: c.baseline_T_mean,
    optimizedTMean: c.optimized_T_mean,
    energyKwh: c.energy_kwh,
    savingPct: c.saving_pct,
    tMax: c.T_max,
    constraint: { tMeanMax: c.constraint.T_mean_max },
  };
  return { ok: true, data: { modelVersion: parsed.data.model_version, control, frames: parsed.data.frames } };
}
