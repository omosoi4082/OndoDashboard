// 현재·예측 모드가 함께 쓰는 실측 구간 37건(5분 간격) 입력 빌더(docs/02-relay-api.md 6장).
// - fan_pct: 센서 1분 이력 → 5분 집계·결측 처리(docs/03 1.2).
// - T_out·RH_out: 기상청 초단기실황 최근 정시 4회 → 5분 보간(2026-10-13 B-3). 연속 2개 이상
//   결측이면 '기상청 실황 조회 실패' — 예측 모드도 실측 구간을 못 만들어 같은 문구로 중단된다.
import type { ApiError, ApiErrorCode } from '@ondo/shared';
import type { SensorHistoryClient } from '../clients/sensorHistoryClient.js';
import type { KmaClient } from '../clients/kmaClient.js';
import type { ComputeRequestInput } from '../clients/computeClient.js';
import { fiveMinuteMarks, type TenMinuteWindow } from '../transforms/currentWindow.js';
import { aggregateAndValidate, type AggregateThresholds } from '../transforms/aggregate5min.js';
import { buildSensorErrorMessage } from '../transforms/sensorErrorMessage.js';
import { outdoorFiveMinuteSeries, outdoorHourMarks, parseObservedValue } from '../transforms/outdoorHistory.js';
import { formatKstWallClockNaive } from '../utils/time.js';

const FAN_LABEL = '환기팬 가동률';
export const KMA_NCST_FAILED_MESSAGE = '기상청 실황 조회 실패';

export interface MeasuredInputsDeps {
  sensorHistoryClient: SensorHistoryClient;
  kmaClient: KmaClient;
  fanPath: string;
  fanThreshold: AggregateThresholds;
  /** 기상청 실황 값의 유효 범위 — 밖이면 그 정시는 결측(기상청 결측 표기 −998.9 등). */
  outdoorRange: { tempMin: number; tempMax: number; rhMin: number; rhMax: number };
}

export type MeasuredInputsResult =
  | { ok: true; inputs: ComputeRequestInput[] }
  | { ok: false; code: ApiErrorCode; source: ApiError['error']['source']; message: string };

export async function buildMeasuredInputs(deps: MeasuredInputsDeps, window: TenMinuteWindow): Promise<MeasuredInputsResult> {
  const hours = outdoorHourMarks(window);
  const [fanRaw, ncsts] = await Promise.all([
    deps.sensorHistoryClient.range(deps.fanPath, window.startMin, window.endMin),
    Promise.all(hours.map((h) => deps.kmaClient.getUltraSrtNcstAtHour(h))),
  ]);

  const fanAgg = aggregateAndValidate(fanRaw, deps.fanThreshold);
  if (fanAgg.error) {
    const message = buildSensorErrorMessage([{ label: FAN_LABEL, path: deps.fanPath, missingMinutes: fanAgg.error.missingMinutes }]);
    return { ok: false, code: 'UPSTREAM_ERROR', source: 'sensor', message };
  }

  const r = deps.outdoorRange;
  const marks = fiveMinuteMarks(window.startMin, window.endMin); // 37개
  const tOut = outdoorFiveMinuteSeries(hours, ncsts.map((n) => parseObservedValue(n?.map['T1H'], r.tempMin, r.tempMax)), marks);
  const rhOut = outdoorFiveMinuteSeries(hours, ncsts.map((n) => parseObservedValue(n?.map['REH'], r.rhMin, r.rhMax)), marks);
  if (!tOut.ok || !rhOut.ok) {
    return { ok: false, code: 'UPSTREAM_ERROR', source: 'kma', message: KMA_NCST_FAILED_MESSAGE };
  }

  const inputs: ComputeRequestInput[] = [];
  for (let i = 0; i < marks.length; i += 1) {
    const mark = marks[i];
    const t = tOut.values[i];
    const rh = rhOut.values[i];
    const fanPct = fanAgg.values[i];
    if (!mark || t === undefined || rh === undefined || fanPct === null || fanPct === undefined) {
      // 오류 판정을 통과했다면 이론상 null이 없어야 한다 — 방어적 가드(docs/03 4.1).
      return { ok: false, code: 'INTERNAL_ERROR', source: 'relay', message: '집계 결과에 결측 값이 남아 있습니다.' };
    }
    inputs.push({ time: formatKstWallClockNaive(mark), T_out: t, RH_out: rh, fan_pct: fanPct });
  }
  return { ok: true, inputs };
}
