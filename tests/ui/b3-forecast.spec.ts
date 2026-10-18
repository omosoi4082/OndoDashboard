// B-3. 예측 모드 — 테스트-체크리스트.md B-3의 8개 항목.
import { expect, test } from '@playwright/test';
import {
  detail3dCanvas,
  expectCanvasChanged,
  expectCanvasNotBlank,
  dragTimeline,
  openDashboard,
  openMode,
  playButton,
  sliderIndex,
  snapshot,
  timelineResetButton,
  timelineSlider,
} from './helpers.js';

test.beforeEach(async ({ page }) => {
  await openDashboard(page);
  await openMode(page, '예측 모드');
});

test('B-3-1 예측 모드 탭을 누르면 3D가 나온다', async ({ page }) => {
  await expectCanvasNotBlank(detail3dCanvas(page), '예측 모드 3D');
});

test('B-3-2 시간 설정 영역에 재생 버튼과 막대가 있다', async ({ page }) => {
  await expect(page.getByText('시간 설정')).toBeVisible();
  await expect(playButton(page)).toBeVisible();
  await expect(timelineSlider(page)).toBeVisible();
});

test('B-3-3 막대 양 끝에 현재 시각과 마지막 시각이 적혀 있다', async ({ page }) => {
  // 왼쪽은 "현재 MM/DD HH:mm"(2026-10-13 온도 측 B-7 확정), 오른쪽은 "현재 시각 / 마지막 시각".
  await expect(page.getByText(/^현재 \d{2}\/\d{2} \d{2}:\d{2}$/)).toBeVisible();
  await expect(page.getByText(/\d{2}\/\d{2} \d{2}:\d{2} \/ \d{2}\/\d{2} \d{2}:\d{2}/)).toBeVisible();
});

test('B-3-4 재생 버튼을 누르면 막대가 움직이고 3D 색이 바뀐다', async ({ page }) => {
  const canvas = detail3dCanvas(page);
  const before = await snapshot(canvas);
  const startIndex = await sliderIndex(page);
  await playButton(page).click();
  await expect(async () => {
    expect(await sliderIndex(page), '재생을 눌렀는데 막대가 움직이지 않습니다').toBeGreaterThan(startIndex);
  }).toPass({ timeout: 10_000 });
  await expectCanvasChanged(canvas, before, '타임라인 재생');
});

test('B-3-5 다시 누르면 멈춘다', async ({ page }) => {
  await playButton(page).click();
  await expect(async () => {
    expect(await sliderIndex(page)).toBeGreaterThan(0);
  }).toPass({ timeout: 10_000 });
  await playButton(page).click();
  const stopped = await sliderIndex(page);
  await page.waitForTimeout(2_000);
  expect(await sliderIndex(page), '일시정지했는데 계속 재생됩니다').toBe(stopped);
});

test('B-3-6 막대를 끌면 3D와 2D가 같이 바뀐다', async ({ page }) => {
  const canvas = detail3dCanvas(page);
  const before = await snapshot(canvas);
  const moved = await dragTimeline(page, 0.7);
  expect(moved, '막대를 끌었는데 위치가 그대로입니다').toBeGreaterThan(0);
  await expectCanvasChanged(canvas, before, '타임라인 드래그');
});

test('B-3-7 초기화를 누르면 맨 처음으로 돌아가고 멈춘다', async ({ page }) => {
  await playButton(page).click();
  await expect(async () => {
    expect(await sliderIndex(page)).toBeGreaterThan(0);
  }).toPass({ timeout: 10_000 });
  await timelineResetButton(page).click();
  expect(await sliderIndex(page), '초기화했는데 맨 처음으로 돌아가지 않았습니다').toBe(0);
  await page.waitForTimeout(2_000);
  expect(await sliderIndex(page), '초기화했는데 재생이 계속됩니다').toBe(0);
});

test('B-3-8 재생이 제 속도로 넘어간다', async ({ page }) => {
  // 설계값은 프레임당 0.5초(TIMELINE_FRAME_DURATION_MS). 3초면 6프레임 전후다.
  // 눈에 보이는 "뚝뚝 끊김"(렌더 지연)까지는 판정할 수 없다 — 사람이 볼 항목으로 남긴다.
  await timelineResetButton(page).click();
  await playButton(page).click();
  const t0 = Date.now();
  await page.waitForTimeout(3_000);
  const advanced = await sliderIndex(page);
  const seconds = (Date.now() - t0) / 1000;
  const expected = seconds / 0.5;
  expect(
    advanced,
    `${seconds.toFixed(1)}초 동안 ${advanced}프레임만 넘어갔습니다(설계값 약 ${expected.toFixed(0)}프레임)`,
  ).toBeGreaterThanOrEqual(Math.floor(expected * 0.5));
});
