// docs/02-relay-api.md 6장 GET /api/detail/current. 흐름: 10분 구간 계산 → 실측 37건(팬은 센서
// 5분 집계, 외기 온·습도는 기상청 실황 정시 보간 — measuredInputs.ts) → 결측이 심하면 연산
// 서버를 호출하지 않고 ApiError → 정상이면 POST /v1/current → 응답 변환(+09:00·range·geometryId·배열 개수 검증) → 캐시.
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ApiError, ApiErrorCode, ApiOk, CurrentDetail, Geometry } from '@ondo/shared';
import type { ComputeClient } from '../clients/computeClient.js';
import { completedTenMinuteWindow } from '../transforms/currentWindow.js';
import { buildCurrentDetail } from '../transforms/detailTransform.js';
import { httpStatusForErrorCode } from '../utils/apiError.js';
import { formatKstWallClockCompact, kstWallClock, nowKstIso } from '../utils/time.js';
import { buildMeasuredInputs, type MeasuredInputsDeps } from './measuredInputs.js';

// 끝 시각(10분 단위) 단위 메모리 캐시(docs/02-relay-api.md 6장·8장). 단일 프로세스 가정,
// 재시작 시 날아가도 무방 — 가장 최근 끝 시각 하나만 보관(무한정 쌓이지 않게).
let cachedEndKey: string | null = null;
let cachedDetail: CurrentDetail | null = null;

function sendError(reply: FastifyReply, requestedAt: string, code: ApiErrorCode, source: ApiError['error']['source'], message: string): ApiError {
  const body: ApiError = { status: 'error', requestedAt, error: { code, source, message } };
  reply.code(httpStatusForErrorCode(code));
  return body;
}

export function registerDetailCurrentRoute(
  app: FastifyInstance,
  deps: {
    measured: MeasuredInputsDeps;
    computeClient: ComputeClient;
    geometry: Geometry;
  },
): void {
  app.get('/api/detail/current', async (_request, reply): Promise<ApiOk<CurrentDetail> | ApiError> => {
    const requestedAt = nowKstIso();
    const now = kstWallClock(new Date());
    const window = completedTenMinuteWindow(now);
    const endKey = formatKstWallClockCompact(window.endMin);

    if (cachedEndKey === endKey && cachedDetail) {
      return { status: 'ok', requestedAt, data: cachedDetail };
    }

    const measured = await buildMeasuredInputs(deps.measured, window);
    if (!measured.ok) {
      return sendError(reply, requestedAt, measured.code, measured.source, measured.message);
    }
    const inputs = measured.inputs;

    const computeResult = await deps.computeClient.requestCurrent(inputs);
    if (!computeResult.ok) {
      return sendError(reply, requestedAt, computeResult.code, 'compute', computeResult.message);
    }

    const transformed = buildCurrentDetail({
      computeFrames: computeResult.frames,
      modelVersion: computeResult.modelVersion,
      geometry: deps.geometry,
      responseRange: computeResult.range,
      responseGeometryId: computeResult.geometryId,
    });
    if (!transformed.ok) {
      return sendError(reply, requestedAt, 'UPSTREAM_ERROR', 'compute', transformed.message);
    }

    cachedEndKey = endKey;
    cachedDetail = transformed.data;

    return { status: 'ok', requestedAt, data: transformed.data };
  });
}
