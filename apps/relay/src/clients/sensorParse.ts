// 센서 서버 응답 파싱(docs/03-upstream-apis.md 1장). 순수 함수 + 단위 테스트(sensorParse.test.ts).
// 항목은 항목명(키)으로 찾는다 — 순서에 의존하지 않는다. 없으면 호출부에서 null 처리.

export interface SensorItemRaw {
  timestamp: string; // 타임존 없음(KST로 간주)
  value: number | string; // 대부분 숫자. WIND는 문자열일 수도 있음(docs/03 3장)
}

export type SensorDevice = Record<string, SensorItemRaw>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isSensorItemRaw(v: unknown): v is SensorItemRaw {
  return isRecord(v) && typeof v['timestamp'] === 'string' && (typeof v['value'] === 'number' || typeof v['value'] === 'string');
}

/**
 * `GET /sensors/{경로}` 응답(JSON)에서 경로 세그먼트를 따라 내려가 장비 객체를 얻는다.
 * 중간 경로가 없거나 최종 객체가 장비 형식이 아니면 null.
 * devicePath 예: "JE/EX/NH/EN1".
 */
export function parseSensorLatestResponse(json: unknown, devicePath: string): SensorDevice | null {
  if (!isRecord(json)) return null;
  const data = json['data'];
  if (!isRecord(data)) return null;

  const segments = devicePath.split('/').filter((s) => s.length > 0);
  let cursor: unknown = data;
  for (const seg of segments) {
    if (!isRecord(cursor)) return null;
    cursor = cursor[seg];
  }
  if (!isRecord(cursor)) return null;

  const device: SensorDevice = {};
  for (const [key, val] of Object.entries(cursor)) {
    if (isSensorItemRaw(val)) {
      device[key] = val;
    }
    // 항목 형식이 아니면(예: 알 수 없는 중첩 객체) 조용히 건너뛴다 — 항목 누락과 동일하게 취급.
  }
  return device;
}
