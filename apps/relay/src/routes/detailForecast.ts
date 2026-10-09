// docs/02-relay-api.md 6장 GET /api/detail/forecast. 흐름: 현재 모드와 같은 37건(5분 집계,
// 결측 판정 공유) + 기상청 단기예보(getVilageFcst) 정시 TMP·REH → 5분 간격 288건 보간
// (fan_pct는 외기 기온 규칙) = 325건 → POST /v1/forecast → 응답 변환(+09:00·offsetMin·
// geometryId·range·배열 개수 검증, 145프레임). 탭 선택 시 1회 호출(캐시 없음, docs/01 4.2).
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ApiError, ApiErrorCode, ApiOk, ForecastDetail, Geometry } from '@ondo/shared';
import type { SensorHistoryClient } from '../clients/sensorHistoryClient.js';
import type { ComputeClient, ComputeRequestInput } from '../clients/computeClient.js';
import type { KmaClient, KmaFcstResult } from '../clients/kmaClient.js';
import { completedTenMinuteWindow, fiveMinuteMarks } from '../transforms/currentWindow.js';
import { aggregateAndValidate, type AggregateThresholds } from '../transforms/aggregate5min.js';
import { buildSensorErrorMessage, type SensorFieldError } from '../transforms/sensorErrorMessage.js';
import { buildForecastDetail } from '../transforms/detailTransform.js';
import {
  ceilToHour,
  fanPctFromTemp,
  fillHourlyGaps,
  fiveMinuteSeriesMarks,
  floorToHour,
  hourKeyOf,
  hourlyMarks,
  hourlyValuesAtMarks,
  interpolateAtTime,
  mergeHourlyFallback,
  type FanPctConfig,
} from '../transforms/forecastInterpolate.js';
import { httpStatusForErrorCode } from '../utils/apiError.js';
import { formatKstWallClockNaive, kstWallClock, nowKstIso } from '../utils/time.js';
import { parseFcstDateTime, type KmaFcstItem } from '../clients/kmaParse.js';

const FORECAST_5MIN_COUNT = 288; // docs/03-upstream-apis.md 2장 "24시간"
const MINUTE_MS = 60_000;

const FIELD_LABELS = {
  tOut: '기상대 온도',
  rhOut: '기상대 습도',
  fanPct: '환기팬 가동률',
} as const;

function sendError(reply: FastifyReply, requestedAt: string, code: ApiErrorCode, source: ApiError['error']['source'], message: string): ApiError {
  const body: ApiError = { status: 'error', requestedAt, error: { code, source, message } };
  reply.code(httpStatusForErrorCode(code));
  return body;
}

/** KmaFcstItem[] 중 category에 해당하는 항목을 hourKeyOf 키로 맵핑한다(순서 의존 없음). */
function categoryMap(items: readonly KmaFcstItem[], category: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    if (item.category !== category) continue;
    const n = Number(item.fcstValue);
    if (!Number.isFinite(n)) continue;
    // parseFcstDateTime은 kmaBaseTime.ts의 kstWallClock 표현과 같은 Date를 만든다(getUTC*가
    // KST 벽시계 값) — hourlyMarks/hourKeyOf와 같은 표현을 그대로 재사용할 수 있다.
    map.set(hourKeyOf(parseFcstDateTime(item.fcstDate, item.fcstTime)), n);
  }
  return map;
}

/** base_time(KmaFcstResult.baseAt, +09:00 부착) → 연산 서버로 보낼 타임존 없는 KST 문자열. */
function naiveFromIso(iso: string): string {
  return iso.replace('+09:00', '');
}

/** 타입 가드: 결측(null) 없는 배열인지 확인(as 캐스팅 없이 number[]로 좁힌다). */
function isAllNumber(values: readonly (number | null)[]): values is number[] {
  return values.every((v) => v !== null);
}

export function registerDetailForecastRoute(
  app: FastifyInstance,
  deps: {
    sensorHistoryClient: SensorHistoryClient;
    kmaClient: KmaClient;
    computeClient: ComputeClient;
    geometry: Geometry;
    inputPaths: { tOut: string; rhOut: string; fanPct: string };
    thresholds: { temp: AggregateThresholds; rh: AggregateThresholds; fan: AggregateThresholds };
    forecastGapMaxHours: number;
    fanPctConfig: FanPctConfig;
  },
): void {
  app.get('/api/detail/forecast', async (_request, reply): Promise<ApiOk<ForecastDetail> | ApiError> => {
    const requestedAt = nowKstIso();
    // KmaClient는 실제 시각(Date)을 받아 내부에서 kstWallClock을 적용한다 — 이미 변환한 now를
    // 넘기면 +9h가 두 번 걸려 아직 발표 전인 base_time을 요청하게 된다(mainWeatherKma.ts와 동일).
    const realNow = new Date();
    const now = kstWallClock(realNow);
    const window = completedTenMinuteWindow(now);

    // 1) 실측 37건(현재 모드와 같은 5분 집계 구간·결측 판정 공유).
    const [tOutRaw, rhOutRaw, fanRaw] = await Promise.all([
      deps.sensorHistoryClient.range(deps.inputPaths.tOut, window.startMin, window.endMin),
      deps.sensorHistoryClient.range(deps.inputPaths.rhOut, window.startMin, window.endMin),
      deps.sensorHistoryClient.range(deps.inputPaths.fanPct, window.startMin, window.endMin),
    ]);

    const tOutAgg = aggregateAndValidate(tOutRaw, deps.thresholds.temp);
    const rhOutAgg = aggregateAndValidate(rhOutRaw, deps.thresholds.rh);
    const fanAgg = aggregateAndValidate(fanRaw, deps.thresholds.fan);

    const sensorErrors: SensorFieldError[] = [];
    if (tOutAgg.error) sensorErrors.push({ label: FIELD_LABELS.tOut, path: deps.inputPaths.tOut, missingMinutes: tOutAgg.error.missingMinutes });
    if (rhOutAgg.error) sensorErrors.push({ label: FIELD_LABELS.rhOut, path: deps.inputPaths.rhOut, missingMinutes: rhOutAgg.error.missingMinutes });
    if (fanAgg.error) sensorErrors.push({ label: FIELD_LABELS.fanPct, path: deps.inputPaths.fanPct, missingMinutes: fanAgg.error.missingMinutes });

    if (sensorErrors.length > 0) {
      // 센서 쪽이 오류면 기상청·연산 서버를 호출하지 않는다(docs/02-relay-api.md 6장).
      return sendError(reply, requestedAt, 'UPSTREAM_ERROR', 'sensor', buildSensorErrorMessage(sensorErrors));
    }

    const marks = fiveMinuteMarks(window.startMin, window.endMin); // 37개
    const measuredInputs: ComputeRequestInput[] = [];
    for (let i = 0; i < marks.length; i += 1) {
      const mark = marks[i];
      const tOut = tOutAgg.values[i];
      const rhOut = rhOutAgg.values[i];
      const fanPct = fanAgg.values[i];
      if (!mark || tOut === null || tOut === undefined || rhOut === null || rhOut === undefined || fanPct === null || fanPct === undefined) {
        return sendError(reply, requestedAt, 'INTERNAL_ERROR', 'relay', '집계 결과에 결측 값이 남아 있습니다.');
      }
      measuredInputs.push({ time: formatKstWallClockNaive(mark), T_out: tOut, RH_out: rhOut, fan_pct: fanPct });
    }

    // 2) 단기예보 288건(5분 보간) — 마지막 실측 다음 5분부터 24시간.
    const forecastFromMin = new Date(window.endMin.getTime() + 5 * MINUTE_MS);
    const fiveMinMarks = fiveMinuteSeriesMarks(forecastFromMin, FORECAST_5MIN_COUNT);
    const lastMark = fiveMinMarks[fiveMinMarks.length - 1];
    if (!lastMark) {
      return sendError(reply, requestedAt, 'INTERNAL_ERROR', 'relay', '예보 구간 계산에 실패했습니다.');
    }
    const hourMarks = hourlyMarks(floorToHour(forecastFromMin), ceilToHour(lastMark));

    const primary = await deps.kmaClient.getVilageFcst(realNow);
    if (!primary) {
      return sendError(reply, requestedAt, 'UPSTREAM_ERROR', 'kma', '기상청 예보 조회 실패');
    }

    let tmpValues = hourlyValuesAtMarks(hourMarks, categoryMap(primary.items, 'TMP'));
    let rehValues = hourlyValuesAtMarks(hourMarks, categoryMap(primary.items, 'REH'));

    // 24시간을 못 채우면(결측 있으면) 직전 발표분을 재요청해 빈 슬롯만 보충한다(docs/02 6장).
    const issuedAt = primary.baseAt;
    if (tmpValues.includes(null) || rehValues.includes(null)) {
      const fallback: KmaFcstResult | null = await deps.kmaClient.getVilageFcst(realNow, 1);
      if (fallback) {
        tmpValues = mergeHourlyFallback(tmpValues, hourlyValuesAtMarks(hourMarks, categoryMap(fallback.items, 'TMP')));
        rehValues = mergeHourlyFallback(rehValues, hourlyValuesAtMarks(hourMarks, categoryMap(fallback.items, 'REH')));
      }
    }

    const tmpFilled = fillHourlyGaps(tmpValues, deps.forecastGapMaxHours);
    const rehFilled = fillHourlyGaps(rehValues, deps.forecastGapMaxHours);
    if (tmpFilled.failed || rehFilled.failed) {
      return sendError(reply, requestedAt, 'UPSTREAM_ERROR', 'kma', '기상청 예보 조회 실패');
    }
    // fillHourlyGaps가 failed=false면 보통 null이 남지 않는다(연속 결측이 임계값보다 짧을
    // 때만 통과) — 다만 양쪽 끝이 전부 결측인 극단적인 경우는 보간 불가로 null이 남을 수
    // 있어 그 경우도 조회 실패로 본다.
    if (!isAllNumber(tmpFilled.values) || !isAllNumber(rehFilled.values)) {
      return sendError(reply, requestedAt, 'UPSTREAM_ERROR', 'kma', '기상청 예보 조회 실패');
    }
    const tmpHourlyNum = tmpFilled.values;
    const rehHourlyNum = rehFilled.values;

    const forecastInputs: ComputeRequestInput[] = fiveMinMarks.map((mark) => {
      const tOut = interpolateAtTime(mark, hourMarks, tmpHourlyNum);
      const rhOut = interpolateAtTime(mark, hourMarks, rehHourlyNum);
      const fanPct = fanPctFromTemp(tOut, deps.fanPctConfig);
      return { time: formatKstWallClockNaive(mark), T_out: tOut, RH_out: rhOut, fan_pct: fanPct };
    });

    const inputs = [...measuredInputs, ...forecastInputs]; // 325건(docs/02 6장)

    const computeResult = await deps.computeClient.requestForecast(inputs, {
      forecastFrom: formatKstWallClockNaive(forecastFromMin),
      forecastIssuedAt: naiveFromIso(issuedAt),
    });
    if (!computeResult.ok) {
      return sendError(reply, requestedAt, computeResult.code, 'compute', computeResult.message);
    }

    const transformed = buildForecastDetail({
      computeFrames: computeResult.frames,
      modelVersion: computeResult.modelVersion,
      geometry: deps.geometry,
    });
    if (!transformed.ok) {
      return sendError(reply, requestedAt, 'UPSTREAM_ERROR', 'compute', transformed.message);
    }

    return { status: 'ok', requestedAt, data: transformed.data };
  });
}
