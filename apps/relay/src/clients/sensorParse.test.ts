import { describe, expect, it } from 'vitest';
import { parseSensorLatestResponse, parseSensorRangeResponse } from './sensorParse.js';

describe('parseSensorLatestResponse', () => {
  it('정상 응답에서 경로를 따라가 장비 객체를 얻는다', () => {
    const json = {
      mode: 'latest',
      data: {
        JE: {
          EX: {
            NH: {
              EN1: {
                TEMP: { timestamp: '2026-10-05T15:28:10', value: 27.1 },
                RH: { timestamp: '2026-10-05T15:28:10', value: 65.0 },
              },
            },
          },
        },
      },
    };
    expect(parseSensorLatestResponse(json, 'JE/EX/NH/EN1')).toEqual({
      TEMP: { timestamp: '2026-10-05T15:28:10', value: 27.1 },
      RH: { timestamp: '2026-10-05T15:28:10', value: 65.0 },
    });
  });

  it('항목 순서가 뒤섞여도 키로 정확히 찾는다', () => {
    const json = {
      data: {
        JE: {
          EX: {
            NH: {
              EN1: {
                // CO2, NH3, RH, TEMP 순서(문서 예시와 다른 순서)
                CO2: { timestamp: '2026-10-05T15:28:10', value: 820 },
                NH3: { timestamp: '2026-10-05T15:28:10', value: 3.2 },
                RH: { timestamp: '2026-10-05T15:28:10', value: 65.0 },
                TEMP: { timestamp: '2026-10-05T15:28:10', value: 27.1 },
              },
            },
          },
        },
      },
    };
    const device = parseSensorLatestResponse(json, 'JE/EX/NH/EN1');
    expect(device?.['TEMP']?.value).toBe(27.1);
    expect(device?.['CO2']?.value).toBe(820);
  });

  it('항목이 일부 누락돼도 나머지는 정상 반환(누락 항목은 키 자체가 없음)', () => {
    const json = {
      data: {
        JE: {
          EX: {
            NH: {
              EN1: {
                TEMP: { timestamp: '2026-10-05T15:28:10', value: 27.1 },
                // RH, NH3, CO2 누락
              },
            },
          },
        },
      },
    };
    const device = parseSensorLatestResponse(json, 'JE/EX/NH/EN1');
    expect(device?.['TEMP']?.value).toBe(27.1);
    expect(device?.['RH']).toBeUndefined();
    expect(device?.['NH3']).toBeUndefined();
  });

  it('경로 중간이 없으면 null', () => {
    const json = { data: { JE: { EX: {} } } };
    expect(parseSensorLatestResponse(json, 'JE/EX/NH/EN1')).toBeNull();
  });

  it('data 자체가 없으면 null', () => {
    expect(parseSensorLatestResponse({ mode: 'latest' }, 'JE/EX/NH/EN1')).toBeNull();
  });

  it('json이 객체가 아니면 null', () => {
    expect(parseSensorLatestResponse(null, 'JE/EX/NH/EN1')).toBeNull();
    expect(parseSensorLatestResponse('oops', 'JE/EX/NH/EN1')).toBeNull();
  });

  it('WIND처럼 value가 문자열인 항목도 그대로 담는다', () => {
    const json = {
      data: { JE: { OU: { WS: { WS1: { WIND: { timestamp: '2026-10-05T15:28:10', value: 'N' } } } } } },
    };
    const device = parseSensorLatestResponse(json, 'JE/OU/WS/WS1');
    expect(device?.['WIND']).toEqual({ timestamp: '2026-10-05T15:28:10', value: 'N' });
  });
});

describe('parseSensorRangeResponse', () => {
  it('정상 응답에서 경로+항목을 따라가 이력 배열을 얻는다(반올림 없이 원자료 그대로)', () => {
    const json = {
      mode: 'range',
      start: '202610020800',
      end: '202610020801',
      data: {
        JE: {
          EX: {
            NH: {
              EN1: {
                TEMP: [
                  { timestamp: '2026-10-02T08:00:00', value: 26.379999999999995 },
                  { timestamp: '2026-10-02T08:01:00', value: 26.3 },
                ],
              },
            },
          },
        },
      },
    };
    expect(parseSensorRangeResponse(json, 'JE/EX/NH/EN1/TEMP')).toEqual([
      { timestamp: '2026-10-02T08:00:00', value: 26.379999999999995 },
      { timestamp: '2026-10-02T08:01:00', value: 26.3 },
    ]);
  });

  it('항목 순서와 무관하게(경로 자체가 키 탐색이라) 정확히 찾는다', () => {
    const json = {
      data: {
        JE: { OU: { WS: { WS1: { RH: [{ timestamp: '2026-10-02T08:00:00', value: 65.0 }] } } } },
      },
    };
    expect(parseSensorRangeResponse(json, 'JE/OU/WS/WS1/RH')).toEqual([
      { timestamp: '2026-10-02T08:00:00', value: 65.0 },
    ]);
  });

  it('일부 슬롯이 형식에 안 맞으면 조용히 건너뛴다(결측과 동일 취급)', () => {
    const json = {
      data: {
        JE: { EX: { NH: { FN1: { FAN1: [{ timestamp: '2026-10-02T08:00:00', value: 60 }, { oops: true }] } } } },
      },
    };
    expect(parseSensorRangeResponse(json, 'JE/EX/NH/FN1/FAN1')).toEqual([
      { timestamp: '2026-10-02T08:00:00', value: 60 },
    ]);
  });

  it('경로 끝이 배열이 아니면 null', () => {
    const json = { data: { JE: { EX: { NH: { EN1: { TEMP: { not: 'array' } } } } } } };
    expect(parseSensorRangeResponse(json, 'JE/EX/NH/EN1/TEMP')).toBeNull();
  });

  it('경로 중간이 없으면 null', () => {
    const json = { data: { JE: { EX: {} } } };
    expect(parseSensorRangeResponse(json, 'JE/EX/NH/EN1/TEMP')).toBeNull();
  });

  it('data 자체가 없으면 null', () => {
    expect(parseSensorRangeResponse({ mode: 'range' }, 'JE/EX/NH/EN1/TEMP')).toBeNull();
  });
});
