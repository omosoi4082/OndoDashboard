import { describe, expect, it } from 'vitest';
import { buildSensorErrorMessage } from './sensorErrorMessage.js';

describe('buildSensorErrorMessage', () => {
  it('항목 1개면 그 항목만 표시', () => {
    const message = buildSensorErrorMessage([
      { label: '기상대 온도', path: 'JE/OU/WS/WS1/TEMP', missingMinutes: 25 },
    ]);
    expect(message).toBe('센서 오류: 기상대 온도 (JE/OU/WS/WS1/TEMP) — 최근 3시간 중 25분 결측');
  });

  it('여러 항목이면 모두 나열한다', () => {
    const message = buildSensorErrorMessage([
      { label: '기상대 온도', path: 'JE/OU/WS/WS1/TEMP', missingMinutes: 25 },
      { label: '환기팬 가동률', path: 'JE/EX/NH/FN1/FAN1', missingMinutes: 40 },
    ]);
    expect(message).toBe(
      '센서 오류: 기상대 온도 (JE/OU/WS/WS1/TEMP) — 최근 3시간 중 25분 결측; 환기팬 가동률 (JE/EX/NH/FN1/FAN1) — 최근 3시간 중 40분 결측',
    );
  });
});
