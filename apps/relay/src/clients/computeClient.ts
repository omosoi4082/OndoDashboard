// docs/03-upstream-apis.md 4장 "연산 서버". POST /v1/current(이번 M4), /v1/forecast(M5,
// 아직 구현 안 함)의 공통 요청/응답 형태를 추상화한다. ComputeClient 인터페이스는 M5에서
// requestForecast 등을 추가해도 그대로 재사용할 수 있게 설계한다.
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { DetailFrameOutdoor, DetailFrameQuality, DetailFrameSummary, FlowVec } from '@ondo/shared';

export interface ComputeRequestInput {
  time: string; // 타임존 없는 KST 문자열(docs/03 4.1)
  T_out: number;
  RH_out: number;
  fan_pct: number;
}

export interface ComputeFrame {
  time: string; // 타임존 없음(원응답 그대로) — relay가 +09:00 등을 부착(변환기 쪽 책임)
  points: { temp: number[]; rh: number[]; flow: FlowVec[] };
  grid: { temp: number[]; rh: number[] };
  flow: FlowVec[];
  outdoor: DetailFrameOutdoor;
  summary: DetailFrameSummary;
  quality: DetailFrameQuality;
}

export type ComputeErrorCode = 'UPSTREAM_TIMEOUT' | 'UPSTREAM_UNREACHABLE' | 'UPSTREAM_ERROR';

export interface ComputeOkResult {
  ok: true;
  requestId: string;
  modelVersion: string;
  frames: ComputeFrame[];
}

export interface ComputeErrResult {
  ok: false;
  code: ComputeErrorCode;
  message: string;
}

export type ComputeResult = ComputeOkResult | ComputeErrResult;

export interface ForecastRequestExtra {
  forecastFrom: string; // 타임존 없는 KST 문자열 — 예보 구간 첫 시각(docs/02-relay-api.md 6장)
  forecastIssuedAt: string; // 타임존 없는 KST 문자열 — 기상청 발표 시각
}

export interface ComputeClient {
  requestCurrent(inputs: ComputeRequestInput[]): Promise<ComputeResult>;
  /** POST /v1/forecast: inputs(325건) + forecast_from·forecast_issued_at(최상위, docs/02 6장). */
  requestForecast(inputs: ComputeRequestInput[], extra: ForecastRequestExtra): Promise<ComputeResult>;
}

// docs/03-upstream-apis.md 4.2 응답 구조 + 05-open-questions.md #2(model_version·outdoor·
// summary·quality 추가분) 검증. HttpComputeClient와 MockComputeClient 둘 다 같은 형태를
// 만들어내므로(목(mock)도 4.2 형식 그대로 생성) 여기서 함께 검증할 수 있다.
const flowVecSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const outdoorSchema = z.object({
  T_out: z.number().nullable(),
  RH_out: z.number().nullable(),
  fan_pct: z.number().nullable(),
});

const summarySchema = z.object({
  T_mean: z.number(),
  T_min: z.number(),
  T_max: z.number(),
  T_west: z.number(),
  T_east: z.number(),
  RH_mean: z.number(),
  V_mean: z.number(),
  V_max: z.number(),
});

const qualitySchema = z.object({
  in_range: z.boolean(),
  warnings: z.array(z.string()),
});

// export: mock/mock_expert.json·mock_control.json(온도 측 실제 목업 파일)의 frames도 이
// 연산 서버 원응답(4.2) 프레임과 같은 형태이므로 mockFileParse.ts가 그대로 재사용한다.
export const frameSchema = z.object({
  time: z.string().min(1),
  points: z.object({
    temp: z.array(z.number()),
    rh: z.array(z.number()),
    flow: z.array(flowVecSchema),
  }),
  grid: z.object({
    temp: z.array(z.number()),
    rh: z.array(z.number()),
  }),
  flow: z.array(flowVecSchema),
  outdoor: outdoorSchema,
  summary: summarySchema,
  quality: qualitySchema,
});

const computeOkSchema = z.object({
  request_id: z.string(),
  status: z.literal('ok'),
  model_version: z.string(),
  frames: z.array(frameSchema),
});

const computeErrSchema = z.object({
  request_id: z.string().optional(),
  status: z.literal('error'),
  message: z.string(),
});

const computeResponseSchema = z.union([computeOkSchema, computeErrSchema]);

export function parseComputeResponse(json: unknown): ComputeResult {
  const parsed = computeResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, code: 'UPSTREAM_ERROR', message: `연산 서버 응답 형식 오류: ${parsed.error.message}` };
  }
  if (parsed.data.status === 'error') {
    return { ok: false, code: 'UPSTREAM_ERROR', message: parsed.data.message };
  }
  return {
    ok: true,
    requestId: parsed.data.request_id,
    modelVersion: parsed.data.model_version,
    frames: parsed.data.frames,
  };
}

export function buildComputeRequestBody(inputs: ComputeRequestInput[]): { request_id: string; inputs: ComputeRequestInput[] } {
  return { request_id: randomUUID(), inputs };
}

export function buildForecastRequestBody(
  inputs: ComputeRequestInput[],
  extra: ForecastRequestExtra,
): { request_id: string; inputs: ComputeRequestInput[]; forecast_from: string; forecast_issued_at: string } {
  return {
    request_id: randomUUID(),
    inputs,
    forecast_from: extra.forecastFrom,
    forecast_issued_at: extra.forecastIssuedAt,
  };
}

export interface HttpComputeClientOpts {
  baseUrl: string;
  apiKey: string; // 빈 문자열이면 헤더 생략(docs/03 4장)
  apiKeyHeader: string;
  timeoutMs: number;
}

async function postCompute(
  path: string,
  inputs: ComputeRequestInput[],
  opts: HttpComputeClientOpts,
  extra?: ForecastRequestExtra,
): Promise<ComputeResult> {
  // 방어적 재확인(docs/03 4.1): null이 있으면 연산 서버가 BAD_REQUEST로 거부하므로 호출하지 않는다.
  // 5분 집계·결측 처리(aggregate5min.ts)에서 이미 걸러졌어야 하지만, 호출 직전 한 번 더 확인한다.
  const hasNull = inputs.some(
    (inp) => inp.T_out === null || inp.RH_out === null || inp.fan_pct === null || Number.isNaN(inp.T_out),
  );
  if (hasNull) {
    return { ok: false, code: 'UPSTREAM_ERROR', message: '연산 입력에 null 값이 포함돼 호출을 중단했습니다.' };
  }

  const body = JSON.stringify(extra ? buildForecastRequestBody(inputs, extra) : buildComputeRequestBody(inputs));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts.apiKey.length > 0) headers[opts.apiKeyHeader] = opts.apiKey;

    const res = await fetch(`${opts.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    const text = await res.text();

    if (!res.ok) {
      // 오류 응답 본문이 { status: "error", message } 형식일 수도 있으므로 먼저 파싱 시도.
      try {
        const json: unknown = JSON.parse(text);
        const result = parseComputeResponse(json);
        if (!result.ok) return result;
      } catch {
        /* JSON이 아니면 아래 일반 오류로 내려간다. */
      }
      return { ok: false, code: 'UPSTREAM_ERROR', message: `연산 서버 HTTP ${res.status}` };
    }

    const json: unknown = JSON.parse(text);
    return parseComputeResponse(json);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, code: 'UPSTREAM_TIMEOUT', message: '연산 서버 응답 시간 초과' };
    }
    return { ok: false, code: 'UPSTREAM_UNREACHABLE', message: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export function createHttpComputeClient(opts: HttpComputeClientOpts): ComputeClient {
  return {
    requestCurrent(inputs: ComputeRequestInput[]): Promise<ComputeResult> {
      return postCompute('/v1/current', inputs, opts);
    },
    requestForecast(inputs: ComputeRequestInput[], extra: ForecastRequestExtra): Promise<ComputeResult> {
      return postCompute('/v1/forecast', inputs, opts, extra);
    },
  };
}
