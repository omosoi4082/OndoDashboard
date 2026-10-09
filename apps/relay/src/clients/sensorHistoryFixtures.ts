// SENSOR_MODE=mock일 때 쓰는 이력 픽스처(M4). sensorFixtures.ts(최신값)와 같은 목적 —
// 센서 서버에 접근할 수 없는 환경에서도 현재 모드를 끝까지 개발·테스트할 수 있게 한다.
// 결정적(Math.random 없음) 값을 돌려준다 — 같은 분(minute index)에는 항상 같은 값.

/** itemPath(예: "JE/OU/WS/WS1/TEMP") → 분 인덱스(0부터)에서의 값 생성 함수. */
const GENERATORS: Record<string, (minuteIndex: number) => number> = {
  'JE/OU/WS/WS1/TEMP': (i) => 21.5 + Math.sin(i / 23) * 2.5,
  'JE/OU/WS/WS1/RH': (i) => 68 + Math.sin(i / 17) * 6,
  'JE/EX/NH/FN1/FAN1': (i) => 60 + Math.sin(i / 11) * 15,
};

const DEFAULT_GENERATOR = (i: number): number => 50 + Math.sin(i / 20) * 10;

export function mockHistoryValue(itemPath: string, minuteIndex: number): number {
  const gen = GENERATORS[itemPath] ?? DEFAULT_GENERATOR;
  return gen(minuteIndex);
}
