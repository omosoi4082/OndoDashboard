import { describe, expect, it } from 'vitest';
import { buildRoomSummary, clampFanRate } from './roomBuilder.js';
import type { SensorDevice } from '../clients/sensorParse.js';

const EN1: SensorDevice = {
  TEMP: { timestamp: '2026-10-05T15:28:10', value: 27.1 },
  RH: { timestamp: '2026-10-05T15:28:00', value: 65.0 },
  NH3: { timestamp: '2026-10-05T15:27:50', value: 3.2 },
  CO2: { timestamp: '2026-10-05T15:28:05', value: 820 },
};

const FN1: SensorDevice = {
  FAN1: { timestamp: '2026-10-05T15:28:12', value: 65.0 },
};

describe('buildRoomSummary', () => {
  it('두 장비 모두 정상이면 ok, 필드 모두 채워지고 measuredAt은 최신 timestamp', () => {
    const summary = buildRoomSummary('자돈방', EN1, FN1);
    expect(summary).toEqual({
      name: '자돈방',
      sourceStatus: 'ok',
      measuredAt: '2026-10-05T15:28:12+09:00',
      temp: 27.1,
      rh: 65.0,
      nh3: 3.2,
      co2: 820,
      fanRate: 65.0,
    });
  });

  it('FN1(환기팬)만 실패하면 fanRate만 null, 나머지는 채워지고 disconnected', () => {
    const summary = buildRoomSummary('자돈방', EN1, null);
    expect(summary.sourceStatus).toBe('disconnected');
    expect(summary.fanRate).toBeNull();
    expect(summary.temp).toBe(27.1);
    expect(summary.rh).toBe(65.0);
  });

  it('EN1(환경센서)만 실패하면 온습도·NH3·CO2만 null, fanRate는 채워지고 disconnected', () => {
    const summary = buildRoomSummary('자돈방', null, FN1);
    expect(summary.sourceStatus).toBe('disconnected');
    expect(summary.temp).toBeNull();
    expect(summary.rh).toBeNull();
    expect(summary.nh3).toBeNull();
    expect(summary.co2).toBeNull();
    expect(summary.fanRate).toBe(65.0);
  });

  it('둘 다 실패하면 전부 null, disconnected, measuredAt null', () => {
    const summary = buildRoomSummary('자돈방', null, null);
    expect(summary).toEqual({
      name: '자돈방',
      sourceStatus: 'disconnected',
      measuredAt: null,
      temp: null,
      rh: null,
      nh3: null,
      co2: null,
      fanRate: null,
    });
  });

  it('항목(키) 하나가 응답에 없으면 그 값만 null, 장비는 연결된 것으로 본다', () => {
    const partialEn1: SensorDevice = {
      TEMP: { timestamp: '2026-10-05T15:28:10', value: 27.1 },
      // RH, NH3, CO2 누락
    };
    const summary = buildRoomSummary('자돈방', partialEn1, FN1);
    expect(summary.sourceStatus).toBe('ok');
    expect(summary.temp).toBe(27.1);
    expect(summary.rh).toBeNull();
    expect(summary.nh3).toBeNull();
    expect(summary.co2).toBeNull();
  });
});

// 2026-10-17 전달 패키지 점검에서 메인 화면 자돈방 환기량이 128%로 나와 찾은 누락.
// 연산 입력(aggregate5min)에는 A-2 클램프를 넣었는데 화면 표시 경로에는 빠져 있었다.
describe('clampFanRate — 환기팬 범위 밖 값(A-2)', () => {
  it('100을 넘으면 100으로 자른다 — 가동률은 100%를 넘을 수 없다', () => {
    expect(clampFanRate(128)).toBe(100);
    expect(clampFanRate(172.5)).toBe(100);
  });

  it('음수는 0으로 자른다', () => {
    expect(clampFanRate(-3)).toBe(0);
  });

  it('범위 안 값은 그대로 둔다(반올림하지 않는다)', () => {
    expect(clampFanRate(46)).toBe(46);
    expect(clampFanRate(64.3)).toBe(64.3);
    expect(clampFanRate(0)).toBe(0);
    expect(clampFanRate(100)).toBe(100);
  });

  it('결측은 결측으로 둔다 — 0으로 채우지 않는다', () => {
    expect(clampFanRate(null)).toBeNull();
  });

  it('범위를 직접 줄 수 있다(.env SENSOR_FAN_MIN/MAX)', () => {
    expect(clampFanRate(90, { min: 20, max: 80 })).toBe(80);
    expect(clampFanRate(10, { min: 20, max: 80 })).toBe(20);
  });
});

describe('buildRoomSummary — 환기팬 클램프 연결', () => {
  it('FAN1이 범위를 벗어나면 잘린 값이 RoomSummary에 들어간다', () => {
    const fn1 = { FAN1: { timestamp: '2026-10-17T15:00:00', value: 128 } };
    expect(buildRoomSummary('자돈방', null, fn1).fanRate).toBe(100);
  });
});
