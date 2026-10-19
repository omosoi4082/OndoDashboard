// docs/03-upstream-apis.md 4장 "연산 서버". POST /v1/current(이번 M4), /v1/forecast(M5,
// 아직 구현 안 함)의 공통 요청/응답 형태를 추상화한다. ComputeClient 인터페이스는 M5에서
// requestForecast 등을 추가해도 그대로 재사용할 수 있게 설계한다.
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { DetailFrameOutdoor, DetailFrameQuality, DetailFrameSummary, FlowVec, MinMax } from '@ondo/shared';

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

/**
 * 연산 서버가 돌려주는 색 범위(v3, 2026-10-13부터). 응답 형식은 `[min, max]` 배열이라
 * 우리 MinMax(`{min, max}`)로 바꿔 담는다.
 *
 * 이 값을 **그대로** 써야 한다(relay가 프레임을 훑어 계산하지 않는다). 특히 flow의 max는
 * 급기구 바로 아래 극값을 뺀 95퍼센타일이라, 우리가 실제 최댓값으로 계산하면 극값 하나
 * 때문에 나머지 288점이 색 범위 하단에 몰려 화면이 거의 단색이 된다(mock/README.md).
 */
export interface ComputeRange {
  temp: MinMax;
  rh: MinMax;
  flow: MinMax;
}

export interface ComputeOkResult {
  ok: true;
  requestId: string;
  modelVersion: string;
  frames: ComputeFrame[];
  /** v3부터. 없으면(구버전 목업·합성 생성기) relay가 프레임에서 계산한다. */
  range?: ComputeRange;
  /** v3부터. 있으면 보관한 Geometry의 geometryId와 일치해야 한다. */
  geometryId?: string;
  /** forecast·control만. 요청 값을 그대로 돌려준다. */
  forecastIssuedAt?: string;
}

/**
 * 연산 서버 오류 본문의 `code`(2026-10-13 온도 측 D-4 확정). 재시도 판단에 쓴다
 * (clients/computeRetry.ts) — BAD_REQUEST는 재시도 안 함, SERVER·BUSY는 1분 뒤 1회 재시도.
 */
export type ComputeUpstreamCode = 'BAD_REQUEST' | 'SERVER' | 'BUSY';

export interface ComputeErrResult {
  ok: false;
  code: ComputeErrorCode;
  message: string;
  /** 연산 서버가 오류 본문에 준 code. 없으면(구버전 목업·알 수 없는 값·본문 없음) 재시도하지 않는다. */
  upstreamCode?: ComputeUpstreamCode;
  /** BAD_REQUEST일 때 문제 입력 항목명(있으면). */
  field?: string;
}

export type ComputeResult = ComputeOkResult | ComputeErrResult;

export interface ForecastRequestExtra {
  forecastFrom: string; // 타임존 없는 KST 문자열 — 예보 구간 첫 시각(docs/02-relay-api.md 6장)
  forecastIssuedAt: string; // 타임존 없는 KST 문자열 — 기상청 발표 시각
}

export interface ComputeClient {
  /** GET /v1/health(2026-10-13 D-5). HTTP 2xx면 true. 실패·타임아웃은 false(예외를 던지지 않는다). */
  ping(): Promise<boolean>;
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

/** v3 `range`: `{temp: [min, max], rh: [...], flow: [0, max]}`(배열 형식). */
const minMaxTupleSchema = z.tuple([z.number(), z.number()]);
export const computeRangeSchema = z.object({
  temp: minMaxTupleSchema,
  rh: minMaxTupleSchema,
  flow: minMaxTupleSchema,
});

/** `[min, max]` 배열 3쌍 → 우리 MinMax 3쌍. */
export function toComputeRange(raw: z.infer<typeof computeRangeSchema>): ComputeRange {
  return {
    temp: { min: raw.temp[0], max: raw.temp[1] },
    rh: { min: raw.rh[0], max: raw.rh[1] },
    flow: { min: raw.flow[0], max: raw.flow[1] },
  };
}

const computeOkSchema = z.object({
  request_id: z.string(),
  status: z.literal('ok'),
  model_version: z.string(),
  frames: z.array(frameSchema),
  // v3 추가분. 구버전 목업·합성 생성기에는 없으므로 optional로 둔다.
  range: computeRangeSchema.optional(),
  geometryId: z.string().optional(),
  forecast_issued_at: z.string().optional(),
});

// D-4(2026-10-13): { request_id?, status: "error", code, field?, message }. code는 구버전 목업에
// 없으므로 optional이고, 모르는 값이 와도 응답 전체를 형식 오류로 만들지 않으려고 문자열로 받은
// 뒤 toUpstreamCode에서 좁힌다(모르는 값 = code 없음과 같이 취급, 재시도 안 함).
const computeErrSchema = z.object({
  request_id: z.string().optional(),
  status: z.literal('error'),
  code: z.string().optional(),
  field: z.string().optional(),
  message: z.string(),
});

const UPSTREAM_CODES: readonly ComputeUpstreamCode[] = ['BAD_REQUEST', 'SERVER', 'BUSY'];

function toUpstreamCode(raw: string | undefined): ComputeUpstreamCode | undefined {
  return UPSTREAM_CODES.find((c) => c === raw);
}

/** 연산 서버 오류 본문 → ComputeErrResult. BAD_REQUEST는 field를 메시지에 붙인다. */
function toComputeErr(err: z.infer<typeof computeErrSchema>): ComputeErrResult {
  const upstreamCode = toUpstreamCode(err.code);
  const field = err.field !== undefined && err.field.length > 0 ? err.field : undefined;
  const message =
    upstreamCode === 'BAD_REQUEST'
      ? `예측 서버 요청 거부: ${err.message}${field ? ` (항목: ${field})` : ''}`
      : err.message;
  return {
    ok: false,
    code: 'UPSTREAM_ERROR',
    message,
    ...(upstreamCode ? { upstreamCode } : {}),
    ...(field ? { field } : {}),
  };
}

const computeResponseSchema = z.union([computeOkSchema, computeErrSchema]);

export function parseComputeResponse(json: unknown): ComputeResult {
  const parsed = computeResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, code: 'UPSTREAM_ERROR', message: `연산 서버 응답 형식 오류: ${parsed.error.message}` };
  }
  if (parsed.data.status === 'error') {
    return toComputeErr(parsed.data);
  }
  const { range, geometryId, forecast_issued_at: forecastIssuedAt } = parsed.data;
  return {
    ok: true,
    requestId: parsed.data.request_id,
    modelVersion: parsed.data.model_version,
    frames: parsed.data.frames,
    ...(range ? { range: toComputeRange(range) } : {}),
    ...(geometryId ? { geometryId } : {}),
    ...(forecastIssuedAt ? { forecastIssuedAt } : {}),
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
  /** GET /v1/health 타임아웃. 진단용이라 연산 타임아웃(60초)보다 짧게 둔다. */
  pingTimeoutMs: number;
}

/** 타임아웃·연결 실패 공통 문구(D-4). 마지막 정상 결과 유지는 대시보드 몫이다. */
export const COMPUTE_UNREACHABLE_MESSAGE = '예측 서버 연결 안 됨';

/**
 * HTTP 403 전용 문구(연산 서버 API 안내 v1.3.2 5장). 연산 서버는 중계 서버 PC의 IP만 허용하도록
 * 설정할 수 있어서, 네트워크가 바뀌거나 DHCP로 주소가 달라지면 403이 온다. 재시도해도 소용없고
 * 온도 측에 IP를 다시 알려야 풀리는 상황이라 원인을 그대로 보여 준다.
 */
export const COMPUTE_FORBIDDEN_MESSAGE =
  '연산 서버가 이 PC의 접속을 허용하지 않습니다(IP 허용 목록 확인 필요)';

function authHeaders(opts: HttpComputeClientOpts): Record<string, string> {
  return opts.apiKey.length > 0 ? { [opts.apiKeyHeader]: opts.apiKey } : {};
}

async function pingCompute(opts: HttpComputeClientOpts): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.pingTimeoutMs);
  try {
    const res = await fetch(`${opts.baseUrl}/v1/health`, {
      method: 'GET',
      headers: authHeaders(opts),
      signal: controller.signal,
    });
    // 본문은 보지 않는다(2xx면 살아 있음). 연결을 닫으려고 읽어서 버린다.
    await res.text().catch(() => '');
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
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
    // charset=utf-8까지 명시(안내 문서 v1.3.2 1장). Accept-Encoding: gzip은 예측 응답
    // 약 6 MB를 0.4 MB로 줄인다 — undici fetch는 이 헤더를 자동으로 붙이지 않지만, 받은
    // 응답의 content-encoding은 스스로 풀어 주므로 본문 파싱은 그대로다.
    const headers: Record<string, string> = {
      'Content-Type': 'application/json; charset=utf-8',
      'Accept-Encoding': 'gzip',
      ...authHeaders(opts),
    };

    const res = await fetch(`${opts.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    const text = await res.text();

    if (!res.ok) {
      // 403은 IP 허용 목록 문제다(v1.3.2 5장) — 본문 code가 우리 enum에 없으므로 먼저 걸러
      // 원인을 알려 준다. 재시도 대상도 아니다(upstreamCode를 비워 두면 재시도하지 않는다).
      if (res.status === 403) {
        return { ok: false, code: 'UPSTREAM_ERROR', message: COMPUTE_FORBIDDEN_MESSAGE };
      }
      // 오류 응답 본문이 { status: "error", code, field?, message }(D-4) 형식이면 code를 살린다.
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
      return { ok: false, code: 'UPSTREAM_TIMEOUT', message: COMPUTE_UNREACHABLE_MESSAGE };
    }
    if (err instanceof SyntaxError) {
      // 2xx인데 본문이 JSON이 아님 — 연결 문제가 아니라 응답 형식 문제다.
      return { ok: false, code: 'UPSTREAM_ERROR', message: `연산 서버 응답 형식 오류: ${err.message}` };
    }
    console.warn(`[compute] 연결 실패: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, code: 'UPSTREAM_UNREACHABLE', message: COMPUTE_UNREACHABLE_MESSAGE };
  } finally {
    clearTimeout(timer);
  }
}

export function createHttpComputeClient(opts: HttpComputeClientOpts): ComputeClient {
  return {
    ping(): Promise<boolean> {
      return pingCompute(opts);
    },
    requestCurrent(inputs: ComputeRequestInput[]): Promise<ComputeResult> {
      return postCompute('/v1/current', inputs, opts);
    },
    requestForecast(inputs: ComputeRequestInput[], extra: ForecastRequestExtra): Promise<ComputeResult> {
      return postCompute('/v1/forecast', inputs, opts, extra);
    },
  };
}
