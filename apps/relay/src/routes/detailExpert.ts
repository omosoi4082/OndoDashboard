// docs/02-relay-api.md 6장 POST /api/detail/expert, 본문 rows[24]{temp, rh, vent}(B-2).
// 24행·빈칸 불허·범위 검사(위반 시 400) — 대시보드 입력 표에서도 같은 범위를 검사하지만 직접
// 호출(curl 등) 대비 중계 서버도 재확인한다(transforms/expertRequestValidate.ts). 통과하면
// mock/mock_expert.json(실제 목업 파일, 05-open-questions.md #24)을 읽어 input 필드만
// 요청값으로 교체(echo)하고 나머지(frames 등)는 그대로 반환한다 — 결과는 입력과 무관하다.
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ApiError, ApiErrorCode, ApiOk, ExpertDetail, Geometry } from '@ondo/shared';
import { loadMockExpertFile } from '../config/mockDetailFiles.js';
import { wrapExpertDetail } from '../transforms/detailWrap.js';
import { validateExpertRequest, type ExpertInputRange } from '../transforms/expertRequestValidate.js';
import { httpStatusForErrorCode } from '../utils/apiError.js';
import { nowKstIso } from '../utils/time.js';

export type { ExpertInputRange };

function sendError(reply: FastifyReply, requestedAt: string, code: ApiErrorCode, source: ApiError['error']['source'], message: string): ApiError {
  const body: ApiError = { status: 'error', requestedAt, error: { code, source, message } };
  reply.code(httpStatusForErrorCode(code));
  return body;
}

export function registerDetailExpertRoute(
  app: FastifyInstance,
  deps: { geometry: Geometry; inputRange: ExpertInputRange },
): void {
  app.post('/api/detail/expert', async (request, reply): Promise<ApiOk<ExpertDetail> | ApiError> => {
    const requestedAt = nowKstIso();

    const validated = validateExpertRequest(request.body, deps.inputRange);
    if (!validated.ok) {
      return sendError(reply, requestedAt, 'BAD_REQUEST', 'relay', validated.message);
    }

    const file = loadMockExpertFile();
    if (!file.ok) {
      return sendError(reply, requestedAt, 'INTERNAL_ERROR', 'relay', `전문가 모드 목업 파일을 읽을 수 없습니다: ${file.message}`);
    }

    const wrapped = wrapExpertDetail({
      frames: file.data.frames,
      modelVersion: file.data.modelVersion,
      geometry: deps.geometry,
      input: validated.data,
      range: file.data.range,
      geometryId: file.data.geometryId,
    });
    if (!wrapped.ok) {
      return sendError(reply, requestedAt, 'UPSTREAM_ERROR', 'compute', wrapped.message);
    }

    return { status: 'ok', requestedAt, data: wrapped.data };
  });
}
