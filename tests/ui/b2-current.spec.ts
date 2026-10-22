// B-2. 현재 모드(오른쪽 패널, 기본 선택) — 테스트-체크리스트.md B-2의 10개 항목.
import { expect, test } from '@playwright/test';
import {
  analysisButton,
  detail2dSection,
  detail3dCanvas,
  expect2DSectionDrawn,
  expectCanvasChanged,
  expectCanvasNotBlank,
  detailTooltip,
  hoverDetailPoint,
  modeTab,
  openDashboard,
  pointsToggle,
  snapshot,
  waitForDetail3D,
} from './helpers.js';

test.beforeEach(async ({ page }) => {
  await openDashboard(page);
  await waitForDetail3D(page);
});

test('B-2-1 모드 탭 4개가 있고 현재 모드가 선택돼 있다', async ({ page }) => {
  for (const label of ['현재 모드', '예측 모드', '전문가 모드', '제어 모드']) {
    await expect(modeTab(page, label), `${label} 탭이 없습니다`).toBeVisible();
  }
  const current = await modeTab(page, '현재 모드').getAttribute('class');
  expect(current ?? '', '현재 모드 탭이 선택 상태(초록 채움)가 아닙니다').toContain('bg-ondo-accent');
});

test('B-2-2 3D 자돈방에 포인트가 그려진다', async ({ page }) => {
  // 포인트 개수(125)는 A-5(고정 형상)에서 숫자로 확인한다. 여기서는 그려졌는지만 본다.
  await expectCanvasNotBlank(detail3dCanvas(page), '현재 모드 3D');
  await expect(pointsToggle(page), '포인트 표시가 꺼져 있습니다(기본은 켜짐)').toBeChecked();
});

test('B-2-3 3D 오른쪽에 색 막대(범례)가 보인다', async ({ page }) => {
  await expect(page.getByTestId('detail-legend')).toBeVisible();
});

test('B-2-4 포인트에 마우스를 올리면 X·Y·Z·VALUE 툴팁이 뜬다', async ({ page }) => {
  await hoverDetailPoint(page);
  const text = (await detailTooltip(page).locator('..').innerText()).replace(/\s+/g, ' ');
  for (const key of ['X', 'Y', 'Z', 'VALUE']) {
    expect(text, `툴팁에 ${key} 줄이 없습니다: ${text}`).toContain(key);
  }
});

test('B-2-5 분석 항목에서 유동을 누르면 색이 바뀐다', async ({ page }) => {
  const canvas = detail3dCanvas(page);
  const before = await snapshot(canvas);
  await analysisButton(page, '유동').click();
  const cls = await analysisButton(page, '유동').getAttribute('class');
  expect(cls ?? '', '유동 버튼이 선택 상태가 아닙니다').toContain('#3b3c42');
  await expectCanvasChanged(canvas, before, '분석 항목 → 유동');
});

test('B-2-6 습도를 누르면 색이 바뀐다', async ({ page }) => {
  const canvas = detail3dCanvas(page);
  const before = await snapshot(canvas);
  await analysisButton(page, '습도').click();
  const cls = await analysisButton(page, '습도').getAttribute('class');
  expect(cls ?? '', '습도 버튼이 선택 상태가 아닙니다').toContain('#3b3c42');
  await expectCanvasChanged(canvas, before, '분석 항목 → 습도');
});

test('B-2-7 온도를 누르면 다시 온도 기준으로 돌아온다', async ({ page }) => {
  await analysisButton(page, '습도').click();
  const canvas = detail3dCanvas(page);
  await page.waitForTimeout(800);
  const before = await snapshot(canvas);
  await analysisButton(page, '온도').click();
  const cls = await analysisButton(page, '온도').getAttribute('class');
  expect(cls ?? '', '온도 버튼이 선택 상태가 아닙니다').toContain('#3b3c42');
  await expectCanvasChanged(canvas, before, '분석 항목 → 온도');
});

test('B-2-8 포인트 표시를 끄면 점이 사라진다', async ({ page }) => {
  const canvas = detail3dCanvas(page);
  const before = await snapshot(canvas);
  await page.getByText('포인트 표시').click();
  await expect(pointsToggle(page)).not.toBeChecked();
  await expectCanvasChanged(canvas, before, '포인트 표시 끄기');
});

test('B-2-9 다시 켜면 점이 나온다', async ({ page }) => {
  const canvas = detail3dCanvas(page);
  await page.getByText('포인트 표시').click();
  await expect(pointsToggle(page)).not.toBeChecked();
  await page.waitForTimeout(800);
  const before = await snapshot(canvas);
  await page.getByText('포인트 표시').click();
  await expect(pointsToggle(page)).toBeChecked();
  await expectCanvasChanged(canvas, before, '포인트 표시 다시 켜기');
});

test('B-2-10 아래로 스크롤하면 2D 수평단면이 보인다', async ({ page }) => {
  await expect(detail2dSection(page)).toBeVisible();
  // 히트맵 픽셀 + 칸막이·축 눈금·범례로 본다. 용량 기준(expectCanvasNotBlank)은 단면이
  // 한 색일 때 정상 화면을 빈 화면으로 판정한다(2026-10-22 온도 측 B-2-10, helpers.ts 참고).
  await expect2DSectionDrawn(page);
});
