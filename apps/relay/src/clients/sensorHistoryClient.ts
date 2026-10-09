// docs/03-upstream-apis.md 1.2 "이력(현재 모드 연산 입력용)". 센서 서버는 GET만 호출한다.
// M1의 SensorClient(latest)와 별도로, 기간 조회(range)용 클라이언트.
import { fetchText } from '../utils/fetchText.js';
import { parseSensorRangeResponse } from './sensorParse.js';
import { mockHistoryValue } from './sensorHistoryFixtures.js';
import { formatKstWallClockCompact, formatKstWallClockNaive, toNumberOrNull } from '../utils/time.js';
import { minuteMarks } from '../transforms/currentWindow.js';

export interface SensorHistoryClient {
  /**
   * itemPath 예: "JE/OU/WS/WS1/TEMP"(항목명까지 포함). startMin~endMin(포함, kstWallClock
   * 표현의 Date, 1분 간격)에 맞춰 181개 슬롯 배열을 돌려준다. 빈 분·요청 실패는 null
   * (보간·채움 금지, 반올림 금지, 원자료 값 그대로).
   */
  range(itemPath: string, startMin: Date, endMin: Date): Promise<(number | null)[]>;
}

export function createLiveSensorHistoryClient(opts: { baseUrl: string; timeoutMs: number }): SensorHistoryClient {
  return {
    async range(itemPath: string, startMin: Date, endMin: Date): Promise<(number | null)[]> {
      const marks = minuteMarks(startMin, endMin);
      const slots = new Array<number | null>(marks.length).fill(null);

      const start = formatKstWallClockCompact(startMin);
      const end = formatKstWallClockCompact(endMin);
      const url = `${opts.baseUrl}/sensors/${itemPath}?start=${start}&end=${end}`;

      try {
        const { ok, text } = await fetchText(url, opts.timeoutMs);
        if (!ok) return slots; // 전부 null(결측과 동일하게 취급) — 5분 집계 단계에서 센서 오류로 판정
        const json: unknown = JSON.parse(text);
        const items = parseSensorRangeResponse(json, itemPath);
        if (!items) return slots;

        // timestamp(분 단위, 타임존 없음) → 값. 항목 순서에 의존하지 않고 키(시각 문자열)로 배치.
        const byTimestamp = new Map<string, number | string>();
        for (const item of items) byTimestamp.set(item.timestamp, item.value);

        marks.forEach((mark, i) => {
          const key = formatKstWallClockNaive(mark);
          const raw = byTimestamp.get(key);
          slots[i] = raw === undefined ? null : toNumberOrNull(raw);
        });
        return slots;
      } catch {
        return slots; // 네트워크 오류·타임아웃·파싱 실패 — 전부 null
      }
    },
  };
}

export function createMockSensorHistoryClient(): SensorHistoryClient {
  return {
    async range(itemPath: string, startMin: Date, endMin: Date): Promise<(number | null)[]> {
      const marks = minuteMarks(startMin, endMin);
      return marks.map((_, i) => mockHistoryValue(itemPath, i));
    },
  };
}

export function createSensorHistoryClient(opts: {
  mode: 'live' | 'mock';
  baseUrl: string;
  timeoutMs: number;
}): SensorHistoryClient {
  return opts.mode === 'mock' ? createMockSensorHistoryClient() : createLiveSensorHistoryClient(opts);
}
