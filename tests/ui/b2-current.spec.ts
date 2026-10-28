// B-2. 현재 모드(오른쪽 패널, 기본 선택) — 테스트-체크리스트.md B-2의 12개 항목
// (11은 2026-10-28 단면 높이 슬라이더, 12는 같은 날 "현재 모드엔 배속 버튼 없음").
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
  particleSpeedButton,
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

test('B-2-5 현재 모드에도 입자가 저절로 움직인다', async ({ page }) => {
  // 2026-10-28 온도 측 회신 1번: 네 모드 모두 입자를 보여 준다. 현재 모드는 타임라인이 없어 늘 흐른다.
  // 아무것도 누르지 않았는데 화면이 달라지면 돌고 있는 것이다. 분석 항목에 '유동'이 없는지도 본다.
  await expect(page.getByRole('button', { name: '유동', exact: true }), '유동 버튼이 남아 있습니다').toHaveCount(0);
  const canvas = detail3dCanvas(page);
  await page.waitForTimeout(2_000);
  const before = await snapshot(canvas);
  await expectCanvasChanged(canvas, before, '현재 모드 입자 애니메이션');
});

test('B-2-12 현재 모드에는 배속 버튼이 없다', async ({ page }) => {
  // 2026-10-28 사용자: "현재모드에 배속 없이 기본 1로 … 배속은 타임라인이 있을 때만".
  // 현재 모드는 한 시각만 보여 주므로 배속을 두면 시간이 빨리 흐르는 것처럼 오해할 수 있다.
  for (const speed of [1, 3, 10] as const) {
    await expect(particleSpeedButton(page, speed), `현재 모드에 ${speed}배 버튼이 남아 있습니다`).toHaveCount(0);
  }
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

test('B-2-10 3D 오른쪽 범례 아래에 2D 수평단면이 보인다', async ({ page }) => {
  // 2026-10-28: 아래 2D 칸을 없애고 3D 안에 겹쳤다 — 범례보다 아래, 오른쪽 끝이 범례와 같은 줄.
  const legend = await page.getByTestId('detail-legend').boundingBox();
  const section = await detail2dSection(page).boundingBox();
  expect(legend && section, '범례나 단면 위치를 찾지 못했습니다').toBeTruthy();
  if (legend && section) {
    expect(section.y, '단면이 범례 아래에 있지 않습니다').toBeGreaterThanOrEqual(legend.y + legend.height);
    expect(Math.abs(section.x + section.width - (legend.x + legend.width)), '단면 오른쪽 끝이 범례와 맞지 않습니다').toBeLessThan(2);
  }
  await expect(detail2dSection(page)).toBeVisible();
  // 히트맵 픽셀 + 칸막이·축 눈금·범례로 본다. 용량 기준(expectCanvasNotBlank)은 단면이
  // 한 색일 때 정상 화면을 빈 화면으로 판정한다(2026-10-22 온도 측 B-2-10, helpers.ts 참고).
  await expect2DSectionDrawn(page);
});

test('B-2-11 단면 높이 슬라이더를 옮기면 단면 높이와 3D 판이 바뀐다', async ({ page }) => {
  // 2026-10-28 사용자: 온도 측 샘플처럼 슬라이더로 단면 높이를 옮긴다(배속 앞). 3D에는 방 바깥
  // 반투명 테가 그 높이로 움직이고, 단면 그림 제목의 높이가 바뀐다. 기본은 0.5 m.
  const slider = page.getByRole('slider', { name: '단면 높이' });
  await expect(slider, '단면 높이 슬라이더가 보이지 않습니다').toBeVisible();
  await expect(detail2dSection(page)).toContainText('0.5m');
  const canvas = detail3dCanvas(page);
  await slider.fill('2.5');
  await expect(detail2dSection(page), '단면 높이가 바뀌지 않았습니다').toContainText('2.5m');
  await expectCanvasNotBlank(canvas, '단면 높이 2.5 m');
  await expect2DSectionDrawn(page);
});
