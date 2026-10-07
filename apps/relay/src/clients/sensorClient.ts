// docs/03-upstream-apis.md 1장. 센서 서버는 GET만 호출한다(제어용 POST 절대 호출 금지).
import { fetchText } from '../utils/fetchText.js';
import { parseSensorLatestResponse, type SensorDevice } from './sensorParse.js';
import { SENSOR_FIXTURES } from './sensorFixtures.js';

export interface SensorClient {
  /** devicePath 예: "JE/EX/NH/EN1". 실패(네트워크·타임아웃·파싱 실패)하면 null. */
  latest(devicePath: string): Promise<SensorDevice | null>;
}

export function createLiveSensorClient(opts: { baseUrl: string; timeoutMs: number }): SensorClient {
  return {
    async latest(devicePath: string): Promise<SensorDevice | null> {
      const url = `${opts.baseUrl}/sensors/${devicePath}`;
      try {
        const { ok, text } = await fetchText(url, opts.timeoutMs);
        if (!ok) return null;
        const json: unknown = JSON.parse(text);
        return parseSensorLatestResponse(json, devicePath);
      } catch {
        return null;
      }
    },
  };
}

export function createMockSensorClient(): SensorClient {
  return {
    async latest(devicePath: string): Promise<SensorDevice | null> {
      const fixture = SENSOR_FIXTURES[devicePath];
      return fixture ? { ...fixture } : null;
    },
  };
}

export function createSensorClient(opts: {
  mode: 'live' | 'mock';
  baseUrl: string;
  timeoutMs: number;
}): SensorClient {
  return opts.mode === 'mock' ? createMockSensorClient() : createLiveSensorClient(opts);
}
