// docs/02-relay-api.md 6장 GET /api/detail/control?target=energy(기본)|environment.
// mock/mock_control.json(실제 목업 파일, target:"energy" 시나리오 하나만 있음 —
// 05-open-questions.md #27)을 읽어 그대로 반환하되, target=environment 요청도 같은 파일로
// 응답하고 응답의 target 필드만 요청받은 값으로 덮어쓴다(새 환경 최적화 파일 준비 전까지).
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ApiError, ApiErrorCode, ApiOk, ControlDetail, Geometry } from '@ondo/shared';
import { loadMockControlFile } from '../config/mockDetailFiles.js';
import { wrapControlDetail } from '../transforms/detailWrap.js';
import { httpStatusForErrorCode } from '../utils/apiError.js';
import { nowKstIso } from '../utils/time.js';

function sendError(reply: FastifyReply, requestedAt: string, code: ApiErrorCode, source: ApiError['error']['source'], message: string): ApiError {
  const body: ApiError = { status: 'error', requestedAt, error: { code, source, message } };
  reply.code(httpStatusForErrorCode(code));
  return body;
}

function isControlTarget(v: unknown): v is 'energy' | 'environment' {
  return v === 'energy' || v === 'environment';
}

export function registerDetailControlRoute(app: FastifyInstance, deps: { geometry: Geometry }): void {
  app.get('/api/detail/control', async (request, reply): Promise<ApiOk<ControlDetail> | ApiError> => {
    const requestedAt = nowKstIso();
    const query = request.query as Record<string, unknown>;
    const targetRaw = typeof query.target === 'string' && query.target.length > 0 ? query.target : 'energy';

    if (!isControlTarget(targetRaw)) {
      return sendError(reply, requestedAt, 'BAD_REQUEST', 'relay', `target은 energy 또는 environment여야 합니다(받은 값: ${targetRaw}).`);
    }

    const file = loadMockControlFile();
    if (!file.ok) {
      return sendError(reply, requestedAt, 'INTERNAL_ERROR', 'relay', `제어 모드 목업 파일을 읽을 수 없습니다: ${file.message}`);
    }

    const wrapped = wrapControlDetail({
      frames: file.data.frames,
      modelVersion: file.data.modelVersion,
      geometry: deps.geometry,
      target: targetRaw,
      control: file.data.control,
    });
    if (!wrapped.ok) {
      return sendError(reply, requestedAt, 'UPSTREAM_ERROR', 'compute', wrapped.message);
    }

    return { status: 'ok', requestedAt, data: wrapped.data };
  });
}
