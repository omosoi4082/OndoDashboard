// B-6. 마무리 — 테스트-체크리스트.md B-6의 3개 항목.
import { expect, test } from '@playwright/test';
import {
  detail3dCanvas,
  expectCanvasNotBlank,
  mainCanvas,
  modeTab,
  openDashboard,
  openExpertInput,
  openMode,
  roomMarkerText,
  waitForDetail3D,
  watchConsoleErrors,
} from './helpers.js';

// 브라우저 확장·광고 차단기 등 우리 코드와 무관한 잡음은 뺀다.
const IGNORED = [/favicon/i, /ERR_INTERNET_DISCONNECTED/i, /DevTools/i];

test('B-6-1 네 모드를 다 돌아도 브라우저 콘솔에 빨간 오류가 없다', async ({ page }) => {
  const errors = watchConsoleErrors(page);
  await openDashboard(page);
  await waitForDetail3D(page);
  for (const mode of ['예측 모드', '제어 모드']) {
    await openMode(page, mode);
  }
  await openExpertInput(page);
  await modeTab(page, '현재 모드').click();
  await waitForDetail3D(page);

  const real = errors.filter((e) => !IGNORED.some((p) => p.test(e)));
  expect(real, `콘솔 오류 ${real.length}건:\n${real.slice(0, 5).join('\n')}`).toEqual([]);
});

test('B-6-2 10분 뒤 현재 모드 값이 자동으로 갱신된다', async ({ page }) => {
  // 폴링 간격이 10분이라 그만큼 켜 둬야 확인된다(MAIN_POLL_INTERVAL_MS). 기본 점검에서는
  // 건너뛰고, 확인하려면 ONDO_UI_LONG=1로 실행한다. 체크리스트에도 사람이 볼 항목으로 남겼다.
  test.skip(process.env.ONDO_UI_LONG !== '1', '10분이 걸리는 항목이라 기본 점검에서는 건너뜁니다(ONDO_UI_LONG=1로 실행).');
  test.setTimeout(13 * 60 * 1000);

  await openDashboard(page);
  await waitForDetail3D(page);
  const second = page.waitForRequest((req) => req.url().includes('/api/main/rooms'), { timeout: 11 * 60 * 1000 });
  await expect(second, '10분이 지나도 /api/main/rooms를 다시 부르지 않았습니다').resolves.toBeTruthy();
});

test('B-6-3 새로고침해도 화면이 다시 정상으로 뜬다', async ({ page }) => {
  await openDashboard(page);
  await waitForDetail3D(page);
  await page.reload();
  await expect(mainCanvas(page)).toBeVisible({ timeout: 60_000 });
  await expect(roomMarkerText(page, '자돈방')).toBeVisible({ timeout: 60_000 });
  await waitForDetail3D(page);
  await expectCanvasNotBlank(detail3dCanvas(page), '새로고침 후 3D');
});
