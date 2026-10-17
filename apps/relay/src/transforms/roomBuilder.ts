// docs/02-relay-api.md 4.1 RoomSummary 조립. 순수 함수 + 단위 테스트(roomBuilder.test.ts).
import type { RoomSummary, SourceStatus } from '@ondo/shared';
import type { SensorDevice } from '../clients/sensorParse.js';
import { latestIso, toKstIso, toNumberOrNull } from '../utils/time.js';

interface ResolvedValue {
  value: number;
  timestamp: string; // +09:00 부착 완료
}

function pickNumericItem(device: SensorDevice | null, key: string): ResolvedValue | null {
  if (!device) return null;
  const item = device[key];
  if (!item) return null;
  const value = toNumberOrNull(item.value);
  if (value === null) return null;
  return { value, timestamp: toKstIso(item.timestamp) };
}

/** 환기팬 가동률 표시 범위 — `.env`의 `SENSOR_FAN_MIN`·`SENSOR_FAN_MAX` 기본값과 같다. */
export interface FanRateRange {
  min: number;
  max: number;
}

export const DEFAULT_FAN_RATE_RANGE: FanRateRange = { min: 0, max: 100 };

/**
 * 범위 밖 환기팬 값은 **결측으로 보지 않고 경계값으로 자른다**(2026-10-13 온도 측 A-2:
 * "172.5처럼 튀는 값은 결측이 아니라 0~100으로 잘라 주세요").
 *
 * 연산 입력 쪽(transforms/aggregate5min.ts의 `outOfRange: 'clamp'`)에는 그때 넣었는데
 * **화면 표시 경로에는 빠져 있었다** — 2026-10-17 전달 패키지 점검에서 메인 화면 자돈방
 * 환기량이 `128%`로 나오는 것을 보고 찾았다. 팬 가동률이 100%를 넘을 수는 없다.
 */
export function clampFanRate(value: number | null, range: FanRateRange = DEFAULT_FAN_RATE_RANGE): number | null {
  if (value === null) return null;
  return Math.min(range.max, Math.max(range.min, value));
}

/**
 * EN1(환경센서)·FN1(환기팬) 장비 응답으로 RoomSummary 하나를 조립한다.
 * - 장비 하나라도 가져오지 못했으면(null) sourceStatus='disconnected'(받은 값은 그대로 채운다).
 * - 항목(키) 하나가 응답에 없으면 그 값만 null(장비 자체는 연결된 것으로 본다).
 * - 환기팬 가동률만 범위 밖 값을 자른다(위 clampFanRate 주석 참고).
 */
export function buildRoomSummary(
  name: RoomSummary['name'],
  en1: SensorDevice | null,
  fn1: SensorDevice | null,
  fanRange: FanRateRange = DEFAULT_FAN_RATE_RANGE,
): RoomSummary {
  const temp = pickNumericItem(en1, 'TEMP');
  const rh = pickNumericItem(en1, 'RH');
  const nh3 = pickNumericItem(en1, 'NH3');
  const co2 = pickNumericItem(en1, 'CO2');
  const fan = pickNumericItem(fn1, 'FAN1');

  const measuredAt = latestIso([temp, rh, nh3, co2, fan].map((v) => v?.timestamp ?? null));
  const sourceStatus: SourceStatus = en1 !== null && fn1 !== null ? 'ok' : 'disconnected';

  return {
    name,
    sourceStatus,
    measuredAt,
    temp: temp?.value ?? null,
    rh: rh?.value ?? null,
    nh3: nh3?.value ?? null,
    co2: co2?.value ?? null,
    fanRate: clampFanRate(fan?.value ?? null, fanRange),
  };
}
