/**
 * 필수 설정값 검증 (M7-3).
 *
 * `config/env.ts`는 import하는 순간 `.env`를 읽고 실패하면 `process.exit(1)`을 부르므로
 * 테스트에서 직접 쓸 수 없다. 여기서는 같은 규칙(빈 문자열을 0으로 받지 않는다)만 떼어내
 * 고정한다 — 2026-10-17에 `FARM_LAT=`로 두니 위경도가 0(적도)이 된 채 서버가 정상인 척
 * 뜨는 것을 실측으로 확인해서 넣은 테스트다. 조용히 틀어지는 유형이라 사용자가 자리에 없는
 * 2026-10-23 테스트에서는 특히 위험하다.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// env.ts의 requiredNumber()와 같은 정의. 둘이 갈라지면 이 테스트가 의미를 잃으므로,
// env.ts를 고칠 때 여기도 같이 본다(파일을 import하면 .env를 읽어 버려서 복제했다).
const requiredNumber = (): z.ZodEffects<z.ZodNumber, number, unknown> =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number({ invalid_type_error: '값이 비어 있거나 숫자가 아닙니다' }),
  );

describe('requiredNumber — 빈 값을 0으로 받지 않는다', () => {
  it('빈 문자열은 실패한다 (전에는 0이 됐다)', () => {
    expect(requiredNumber().safeParse('').success).toBe(false);
  });

  it('공백만 있어도 실패한다', () => {
    expect(requiredNumber().safeParse('   ').success).toBe(false);
  });

  it('값이 아예 없어도 실패한다', () => {
    expect(requiredNumber().safeParse(undefined).success).toBe(false);
  });

  it('정상 값은 숫자로 읽는다', () => {
    expect(requiredNumber().parse('33.446297')).toBe(33.446297);
    expect(requiredNumber().parse('53')).toBe(53);
  });

  it('0은 유효한 값이다 — 빈 값과 구분해야 한다', () => {
    expect(requiredNumber().parse('0')).toBe(0);
  });

  it('숫자가 아닌 문자열은 실패한다', () => {
    expect(requiredNumber().safeParse('제주').success).toBe(false);
  });

  it('격자 좌표는 정수만 받는다', () => {
    const grid = requiredNumber().refine(Number.isInteger, '정수여야 합니다');
    expect(grid.parse('53')).toBe(53);
    expect(grid.safeParse('53.5').success).toBe(false);
    expect(grid.safeParse('').success).toBe(false);
  });
});
