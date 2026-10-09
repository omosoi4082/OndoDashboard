// docs/02-relay-api.md 6장 GET /api/detail/current. 흐름: 10분 구간 계산 → 센서 이력(181×3
// 항목) → 5분 집계·결측 처리(37건) → 결측이 심하면 연산 서버를 호출하지 않고 ApiError →
// 정상이면 POST /v1/current → 응답 변환(+09:00·range·geometryId·배열 개수 검증) → 캐시.
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ApiError, ApiErrorCode, ApiOk, CurrentDetail, Geometry } from '@ondo/shared';
import type { SensorHistoryClient } from '../clients/sensorHistoryClient.js';
import type { ComputeClient, ComputeRequestInput } from '../clients/computeClient.js';
import { completedTenMinuteWindow, fiveMinuteMarks } from '../transforms/currentWindow.js';
import { aggregateAndValidate, type AggregateThresholds } from '../transforms/aggregate5min.js';
import { buildSensorErrorMessage, type SensorFieldError } from '../transforms/sensorErrorMessage.js';
import { buildCurrentDetail } from '../transforms/detailTransform.js';
import { httpStatusForErrorCode } from '../utils/apiError.js';
import { formatKstWallClockCompact, formatKstWallClockNaive, kstWallClock, nowKstIso } from '../utils/time.js';

export interface DetailCurrentInputPaths {
  tOut: string;
  rhOut: string;
  fanPct: string;
}

// 세 입력 항목의 표시 라벨(docs/03-upstream-apis.md 1.2 3단계). 경로는 .env(설정)에서 읽고,
// 라벨은 화면 문구이므로 상수로 둔다.
const FIELD_LABELS = {
  tOut: '기상대 온도',
  rhOut: '기상대 습도',
  fanPct: '환기팬 가동률',
} as const;

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
    sensorHistoryClient: SensorHistoryClient;
    computeClient: ComputeClient;
    geometry: Geometry;
    inputPaths: DetailCurrentInputPaths;
    thresholds: { temp: AggregateThresholds; rh: AggregateThresholds; fan: AggregateThresholds };
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

    const [tOutRaw, rhOutRaw, fanRaw] = await Promise.all([
      deps.sensorHistoryClient.range(deps.inputPaths.tOut, window.startMin, window.endMin),
      deps.sensorHistoryClient.range(deps.inputPaths.rhOut, window.startMin, window.endMin),
      deps.sensorHistoryClient.range(deps.inputPaths.fanPct, window.startMin, window.endMin),
    ]);

    const tOutAgg = aggregateAndValidate(tOutRaw, deps.thresholds.temp);
    const rhOutAgg = aggregateAndValidate(rhOutRaw, deps.thresholds.rh);
    const fanAgg = aggregateAndValidate(fanRaw, deps.thresholds.fan);

    const errors: SensorFieldError[] = [];
    if (tOutAgg.error) errors.push({ label: FIELD_LABELS.tOut, path: deps.inputPaths.tOut, missingMinutes: tOutAgg.error.missingMinutes });
    if (rhOutAgg.error) errors.push({ label: FIELD_LABELS.rhOut, path: deps.inputPaths.rhOut, missingMinutes: rhOutAgg.error.missingMinutes });
    if (fanAgg.error) errors.push({ label: FIELD_LABELS.fanPct, path: deps.inputPaths.fanPct, missingMinutes: fanAgg.error.missingMinutes });

    if (errors.length > 0) {
      return sendError(reply, requestedAt, 'UPSTREAM_ERROR', 'sensor', buildSensorErrorMessage(errors));
    }

    const marks = fiveMinuteMarks(window.startMin, window.endMin); // 37개
    const inputs: ComputeRequestInput[] = [];
    for (let i = 0; i < marks.length; i += 1) {
      const mark = marks[i];
      const tOut = tOutAgg.values[i];
      const rhOut = rhOutAgg.values[i];
      const fanPct = fanAgg.values[i];
      if (!mark || tOut === null || tOut === undefined || rhOut === null || rhOut === undefined || fanPct === null || fanPct === undefined) {
        // 오류 판정을 통과했다면 이론상 null이 없어야 한다 — 방어적 가드(docs/03 4.1).
        return sendError(reply, requestedAt, 'INTERNAL_ERROR', 'relay', '집계 결과에 결측 값이 남아 있습니다.');
      }
      inputs.push({ time: formatKstWallClockNaive(mark), T_out: tOut, RH_out: rhOut, fan_pct: fanPct });
    }

    const computeResult = await deps.computeClient.requestCurrent(inputs);
    if (!computeResult.ok) {
      return sendError(reply, requestedAt, computeResult.code, 'compute', computeResult.message);
    }

    const transformed = buildCurrentDetail({
      computeFrames: computeResult.frames,
      modelVersion: computeResult.modelVersion,
      geometry: deps.geometry,
    });
    if (!transformed.ok) {
      return sendError(reply, requestedAt, 'UPSTREAM_ERROR', 'compute', transformed.message);
    }

    cachedEndKey = endKey;
    cachedDetail = transformed.data;

    return { status: 'ok', requestedAt, data: transformed.data };
  });
}
