// docs/03-upstream-apis.md 1.2 3단계: 센서 오류 문구 "센서 오류: <라벨> (<경로>) — 최근
// 3시간 중 N분 결측". 항목별로 독립 판정하고(T_out·RH_out·fan_pct), 여러 개면 모두 나열한다.
// 데이터(라벨·경로·결측분)는 구조화된 형태로 들고 다니다가, relay가 ApiError.message
// 문자열 하나로 조립한다(ApiError 타입에는 message:string 하나뿐이라 — docs/02 2장).

export interface SensorFieldError {
  label: string; // 예: '기상대 온도'
  path: string; // 예: 'JE/OU/WS/WS1/TEMP'
  missingMinutes: number; // N
}

export function buildSensorErrorMessage(errors: readonly SensorFieldError[]): string {
  const parts = errors.map((e) => `${e.label} (${e.path}) — 최근 3시간 중 ${e.missingMinutes}분 결측`);
  return `센서 오류: ${parts.join('; ')}`;
}
