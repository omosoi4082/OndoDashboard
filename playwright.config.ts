// 화면 자동 점검(테스트-체크리스트.md B부) 설정 — Playwright.
//
// 왜 있나: 테스트 기간에 담당자가 자리에 없고 온도 측이 직접 화면을 만져야 한다
// (2026-10-23 전달 전제). A부(check.bat = npm run doctor)는 서버 API만 보므로, 화면이
// 실제로 뜨고 눌리는지는 사람 눈이 유일한 수단이었다. 그 중 기계가 판정할 수 있는 항목을
// 여기로 옮긴다 — 온도 측은 test-ui.bat 한 번으로 "화면점검결과.txt"를 얻는다.
//
// 설계 결정
// - **설치된 Chrome/Edge를 그대로 쓴다**(channel). Playwright 전용 브라우저를 내려받으면
//   130 MB를 더 받아야 하고 사내망에서 막힐 수 있다. 지원 환경이 PC Chrome/Edge라
//   (CLAUDE.md) 어차피 그 둘로 봐야 맞다. 둘 다 없으면 번들 chromium으로 떨어지고,
//   그건 test-ui.bat이 안내한다.
// - **1920×1080 고정**. 화면이 그 기준으로 설계돼 있다(CLAUDE.md). 창 크기와 상관없이
//   이 해상도로 그려지므로 온도 측 모니터가 더 작아도 같은 조건으로 돈다.
// - **창을 띄우고 돈다(headed)**. headless Chrome은 GPU 없이 WebGL을 소프트웨어로 그려서
//   같은 화면이 **20배 느리다**(2026-10-18 실측: 프레임당 340ms vs 17ms). 3D가 두 개 도는
//   화면이라 그 차이로 점검 시간이 몇 배가 되고, 호버 판정도 불안해진다. 창이 뜨는 편이
//   온도 측에서 "지금 무엇을 하는 중인지" 보이기도 한다. ONDO_UI_HEADLESS=1로 끌 수 있다.
// - **worker 1개·순차**. 3D를 두 개 띄우면 서로 느려져 판정이 흔들린다. 파일 안에서는
//   한 페이지를 공유해 체크리스트처럼 "앞 항목에 이어서" 진행한다(helpers.ts 참고).
// - **재시도 없음**. 깜빡 성공한 항목을 성공으로 적으면 무인 테스트의 기록이 거짓이 된다.
import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.ONDO_UI_BASE_URL ?? 'http://localhost:8080';

// 경로는 **슬래시로 적는다** — Node의 fs는 윈도에서도 슬래시를 받고, 역슬래시는 템플릿
// 문자열에서 이스케이프로 먹혀 조용히 사라진다(2026-10-18에 실제로 그래서 탐색이 전부
// 실패하고 번들 chromium으로 떨어졌다).
const PROGRAM_FILES = process.env.ProgramFiles ?? 'C:/Program Files';
const PROGRAM_FILES_X86 = process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)';
const LOCAL_APP_DATA = process.env.LOCALAPPDATA ?? '';

const CHROME_PATHS = [
  `${PROGRAM_FILES}/Google/Chrome/Application/chrome.exe`,
  `${PROGRAM_FILES_X86}/Google/Chrome/Application/chrome.exe`,
  `${LOCAL_APP_DATA}/Google/Chrome/Application/chrome.exe`,
];
const EDGE_PATHS = [
  `${PROGRAM_FILES}/Microsoft/Edge/Application/msedge.exe`,
  `${PROGRAM_FILES_X86}/Microsoft/Edge/Application/msedge.exe`,
];

/** 설치된 브라우저를 고른다. ONDO_UI_BROWSER=chrome|msedge|chromium 으로 덮어쓸 수 있다. */
function pickChannel(): 'chrome' | 'msedge' | undefined {
  const forced = process.env.ONDO_UI_BROWSER;
  if (forced === 'chrome' || forced === 'msedge') return forced;
  if (forced === 'chromium') return undefined;
  if (CHROME_PATHS.some((p) => existsSync(p))) return 'chrome';
  if (EDGE_PATHS.some((p) => existsSync(p))) return 'msedge';
  return undefined;
}

/** 리포터가 결과 파일에 적을 브라우저 이름 — 설정이 고른 값을 그대로 쓴다. */
export const BROWSER_CHANNEL = pickChannel();

export default defineConfig({
  testDir: './tests/ui',
  outputDir: './ui-test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // 3D 로드와 연산 응답(예측 모드는 느릴 수 있다)을 감안한 값. 항목별로 더 늘리는 곳이 있다.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    // 진행 상황·남은 예상 시간·결과 파일을 우리 리포터가 모두 찍는다(기본 list는 중복이라 뺐다).
    ['./tests/ui/reporter.ts'],
    ['html', { open: 'never', outputFolder: 'ui-test-report' }],
  ],
  use: {
    baseURL: BASE_URL,
    headless: process.env.ONDO_UI_HEADLESS === '1',
    viewport: { width: 1920, height: 1080 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    channel: BROWSER_CHANNEL,
    // 실패한 항목만 증거를 남긴다 — 온도 측이 그대로 보내면 원인 추적이 된다.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    launchOptions: {
      // headless Chrome은 GPU 없이 WebGL을 소프트웨어로 돌린다. 최신 Chrome은 이 플래그
      // 없이는 소프트웨어 WebGL을 거부할 수 있어 켜 둔다(GPU가 있으면 무시된다).
      args: ['--enable-unsafe-swiftshader'],
    },
  },
  // 이미 start.bat으로 띄워 뒀으면 그걸 쓰고, 안 떠 있으면 직접 띄운다.
  webServer: {
    command: 'npm start',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
