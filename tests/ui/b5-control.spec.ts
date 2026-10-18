// B-5. 제어 모드 — 테스트-체크리스트.md B-5의 6개 항목.
import { expect, test } from '@playwright/test';
import {
  detail3dCanvas,
  expectCanvasNotBlank,
  modeTab,
  openDashboard,
  openMode,
  playButton,
  sliderIndex,
  waitForDetail3D,
} from './helpers.js';

test.beforeEach(async ({ page }) => {
  await openDashboard(page);
  await openMode(page, '제어 모드');
});

function targetButton(page: Parameters<typeof modeTab>[0], label: string): ReturnType<typeof modeTab> {
  return page.getByRole('button', { name: label, exact: true });
}

/** 요약 카드 안 환기량 비교 그래프. */
function summaryChart(page: Parameters<typeof modeTab>[0]): ReturnType<typeof modeTab> {
  return page.locator('svg[aria-label="기준·최적화 환기량 비교 그래프"]');
}

test('B-5-1 제어 모드 탭을 누르면 3D가 나온다', async ({ page }) => {
  await expectCanvasNotBlank(detail3dCanvas(page), '제어 모드 3D');
});

test('B-5-2 에너지 최적화·환경 최적화 버튼이 있고 에너지가 선택돼 있다', async ({ page }) => {
  await expect(targetButton(page, '에너지 최적화')).toBeVisible();
  await expect(targetButton(page, '환경 최적화')).toBeVisible();
  const cls = await targetButton(page, '에너지 최적화').getAttribute('class');
  expect(cls ?? '', '에너지 최적화가 선택 상태가 아닙니다').toContain('#3c5880');
});

test('B-5-3 요약 카드에 절감률·팬 전력량·최고 온도 숫자가 있다', async ({ page }) => {
  for (const label of ['절감률', '팬 전력량 (kWh)', '최고 온도 (℃)']) {
    await expect(page.getByText(label, { exact: true }), `요약 카드에 "${label}"이 없습니다`).toBeVisible();
  }
  const card = page.getByText('절감률', { exact: true }).locator('../..');
  const text = (await card.innerText()).replace(/\s+/g, ' ');
  expect(text, `요약 카드에 숫자가 없습니다: ${text}`).toMatch(/\d/);
});

test('B-5-4 요약 카드에 선 2개짜리 그래프가 있다', async ({ page }) => {
  await expect(summaryChart(page)).toBeVisible();
  // 기준(점선)·최적화(실선) 두 선 + 재생 위치 세로선.
  await expect(summaryChart(page).locator('path[stroke]')).toHaveCount(2);
  await expect(summaryChart(page).locator('line[stroke="#38bdf8"]')).toHaveCount(1);
});

test('B-5-5 환경 최적화를 누르면 다시 불러와 화면이 갱신된다', async ({ page }) => {
  await targetButton(page, '환경 최적화').click();
  const cls = await targetButton(page, '환경 최적화').getAttribute('class');
  expect(cls ?? '', '환경 최적화가 선택 상태가 아닙니다').toContain('#3c5880');
  await waitForDetail3D(page);
  await expectCanvasNotBlank(detail3dCanvas(page), '환경 최적화 3D');
});

test('B-5-6 재생하면 그래프의 세로선도 같이 움직인다', async ({ page }) => {
  const line = summaryChart(page).locator('line[stroke="#38bdf8"]');
  const before = await line.getAttribute('x1');
  await playButton(page).click();
  await expect(async () => {
    expect(await sliderIndex(page), '재생을 눌렀는데 막대가 움직이지 않습니다').toBeGreaterThan(0);
  }).toPass({ timeout: 10_000 });
  await expect(async () => {
    expect(await line.getAttribute('x1'), '막대는 움직이는데 그래프 세로선이 그대로입니다').not.toBe(before);
  }).toPass({ timeout: 10_000 });
});
