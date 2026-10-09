// docs/02-relay-api.md 6장 GET /api/detail/expert?temp=&rh=&vent=. temp·rh·vent 모두
// 필수(숫자·범위 검사, 위반 시 400) — 대시보드 입력 필드에서도 같은 범위를 검사하지만 직접
// 호출(curl 등) 대비 중계 서버도 재확인한다(docs/05-open-questions.md #11). 통과하면
// mock/mock_expert.json(실제 목업 파일, 05-open-questions.md #24)을 읽어 input 필드만
// 요청값으로 교체(echo)하고 나머지(frames 등)는 그대로 반환한다.
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ApiError, ApiErrorCode, ApiOk, ExpertDetail, Geometry } from '@ondo/shared';
import { loadMockExpertFile } from '../config/mockDetailFiles.js';
import { wrapExpertDetail } from '../transforms/detailWrap.js';
import { httpStatusForErrorCode } from '../utils/apiError.js';
import { nowKstIso } from '../utils/time.js';

export interface ExpertInputRange {
  tempMin: number;
  tempMax: number;
  rhMin: number;
  rhMax: number;
  ventMin: number;
  ventMax: number;
}

function sendError(reply: FastifyReply, requestedAt: string, code: ApiErrorCode, source: ApiError['error']['source'], message: string): ApiError {
  const body: ApiError = { status: 'error', requestedAt, error: { code, source, message } };
  reply.code(httpStatusForErrorCode(code));
  return body;
}

/** 쿼리스트링 값(문자열 또는 undefined)을 숫자로. 빈 값·숫자 아님이면 null. */
function parseNumberParam(raw: unknown): number | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function registerDetailExpertRoute(
  app: FastifyInstance,
  deps: { geometry: Geometry; inputRange: ExpertInputRange },
): void {
  app.get('/api/detail/expert', async (request, reply): Promise<ApiOk<ExpertDetail> | ApiError> => {
    const requestedAt = nowKstIso();
    const query = request.query as Record<string, unknown>;

    const temp = parseNumberParam(query.temp);
    const rh = parseNumberParam(query.rh);
    const vent = parseNumberParam(query.vent);

    if (temp === null || rh === null || vent === null) {
      return sendError(reply, requestedAt, 'BAD_REQUEST', 'relay', 'temp·rh·vent는 모두 숫자로 필수 입력해야 합니다.');
    }

    const r = deps.inputRange;
    if (temp < r.tempMin || temp > r.tempMax) {
      return sendError(reply, requestedAt, 'BAD_REQUEST', 'relay', `temp는 ${r.tempMin}~${r.tempMax} 범위여야 합니다(받은 값: ${temp}).`);
    }
    if (rh < r.rhMin || rh > r.rhMax) {
      return sendError(reply, requestedAt, 'BAD_REQUEST', 'relay', `rh는 ${r.rhMin}~${r.rhMax} 범위여야 합니다(받은 값: ${rh}).`);
    }
    if (vent < r.ventMin || vent > r.ventMax) {
      return sendError(reply, requestedAt, 'BAD_REQUEST', 'relay', `vent는 ${r.ventMin}~${r.ventMax} 범위여야 합니다(받은 값: ${vent}).`);
    }

    const file = loadMockExpertFile();
    if (!file.ok) {
      return sendError(reply, requestedAt, 'INTERNAL_ERROR', 'relay', `전문가 모드 목업 파일을 읽을 수 없습니다: ${file.message}`);
    }

    const wrapped = wrapExpertDetail({
      frames: file.data.frames,
      modelVersion: file.data.modelVersion,
      geometry: deps.geometry,
      input: { temp, rh, vent },
    });
    if (!wrapped.ok) {
      return sendError(reply, requestedAt, 'UPSTREAM_ERROR', 'compute', wrapped.message);
    }

    return { status: 'ok', requestedAt, data: wrapped.data };
  });
}
