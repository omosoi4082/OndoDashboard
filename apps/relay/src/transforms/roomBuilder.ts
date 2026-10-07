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

/**
 * EN1(환경센서)·FN1(환기팬) 장비 응답으로 RoomSummary 하나를 조립한다.
 * - 장비 하나라도 가져오지 못했으면(null) sourceStatus='disconnected'(받은 값은 그대로 채운다).
 * - 항목(키) 하나가 응답에 없으면 그 값만 null(장비 자체는 연결된 것으로 본다).
 */
export function buildRoomSummary(
  name: RoomSummary['name'],
  en1: SensorDevice | null,
  fn1: SensorDevice | null,
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
    fanRate: fan?.value ?? null,
  };
}
