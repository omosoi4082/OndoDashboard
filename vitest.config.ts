import { defineConfig } from 'vitest/config';

// apps/dashboard(React 컴포넌트) 테스트는 M2~M3에서 jsdom 환경과 함께 별도 설정한다.
export default defineConfig({
  test: {
    include: ['apps/relay/src/**/*.test.ts', 'packages/shared/src/**/*.test.ts'],
    passWithNoTests: true, // M1부터 변환 로직 테스트가 생긴다 (CLAUDE.md 코드 규칙)
  },
});
