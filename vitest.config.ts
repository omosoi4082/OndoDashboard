import { defineConfig } from 'vitest/config';

// apps/dashboard 쪽은 M2부터 순수 로직(좌표 변환·배치 계산·컬러맵 등)을 .test.ts로 함께 둔다.
// 컴포넌트 자체(React/DOM) 테스트는 아직 없음 — 필요해지면 jsdom 환경을 추가한다.
export default defineConfig({
  test: {
    include: [
      'apps/relay/src/**/*.test.ts',
      'packages/shared/src/**/*.test.ts',
      'apps/dashboard/src/**/*.test.ts',
    ],
    passWithNoTests: true, // M1부터 변환 로직 테스트가 생긴다 (CLAUDE.md 코드 규칙)
  },
});
