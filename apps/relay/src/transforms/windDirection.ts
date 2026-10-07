// docs/03-upstream-apis.md 3장 "풍향 16방위". 순수 함수 + 단위 테스트(windDirection.test.ts).

export const COMPASS_16 = [
  '북',
  '북북동',
  '북동',
  '동북동',
  '동',
  '동남동',
  '남동',
  '남남동',
  '남',
  '남남서',
  '남서',
  '서남서',
  '서',
  '서북서',
  '북서',
  '북북서',
] as const;

/** 0~360도(그 밖 범위도 정규화) → 16방위 문자열. [348.75, 11.25) = 북(0번 인덱스). */
export function degToCompass16(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  const index = Math.floor((normalized + 11.25) / 22.5) % 16;
  const dir = COMPASS_16[index];
  // index는 항상 0~15 범위이므로 dir은 항상 존재하지만, noUncheckedIndexedAccess 때문에 방어적으로 처리.
  return dir ?? '북';
}

export interface WindResult {
  windDir: string | null;
  windDeg: number | null;
}

/**
 * WIND 원값 → { windDir, windDeg }.
 * 숫자면 각도로 보고 16방위로 변환(windDeg에 원래 각도 보존).
 * 문자열이면 그대로 통과시키고 windDeg는 null(각도 정보 없음).
 * null이면 둘 다 null.
 */
export function resolveWind(raw: number | string | null): WindResult {
  if (raw === null) {
    return { windDir: null, windDeg: null };
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { windDir: null, windDeg: null };
    return { windDir: degToCompass16(raw), windDeg: raw };
  }
  return { windDir: raw, windDeg: null };
}
