// SENSOR_MODE=mock일 때 쓰는 픽스처. 센서 서버에 접근할 수 없는 환경에서도 개발할 수 있게 한다.
import type { SensorDevice } from './sensorParse.js';

function ts(): string {
  // 센서 서버 timestamp 형식(타임존 없음)을 흉내낸다.
  return new Date().toISOString().slice(0, 19);
}

function env(temp: number, rh: number, nh3: number, co2: number): SensorDevice {
  return {
    TEMP: { timestamp: ts(), value: temp },
    RH: { timestamp: ts(), value: rh },
    NH3: { timestamp: ts(), value: nh3 },
    CO2: { timestamp: ts(), value: co2 },
  };
}

function fan(fan1: number): SensorDevice {
  return {
    FAN1: { timestamp: ts(), value: fan1 },
    // FAN2·FAN3는 사용하지 않지만, 실제 응답 형태를 흉내내기 위해 포함.
    FAN2: { timestamp: ts(), value: 0 },
    FAN3: { timestamp: ts(), value: 0 },
  };
}

function station(): SensorDevice {
  return {
    TEMP: { timestamp: ts(), value: 21.5 },
    RH: { timestamp: ts(), value: 68.0 },
    WIND: { timestamp: ts(), value: 227 },
    RAIN: { timestamp: ts(), value: 0 },
    SOLAR: { timestamp: ts(), value: 520 },
    CURWIND: { timestamp: ts(), value: 2.1 },
    MAXWIND: { timestamp: ts(), value: 4.5 },
  };
}

export const SENSOR_FIXTURES: Record<string, SensorDevice> = {
  'JE/EX/NH/EN1': env(27.1, 65.0, 3.2, 820),
  'JE/EX/NH/FN1': fan(65.0),
  'JE/EX/GH/EN1': env(24.8, 60.2, 2.1, 650),
  'JE/EX/GH/FN1': fan(40.0),
  'JE/EX/FH/EN1': env(22.3, 58.0, 1.8, 580),
  'JE/EX/FH/FN1': fan(30.0),
  'JE/OU/WS/WS1': station(),
};
