// B-3. 예측 모드 — 테스트-체크리스트.md B-3의 11개 항목(9~11은 2026-10-27 유동 입자).
import { expect, test } from '@playwright/test';
import {
  analysisButton,
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
  legendTicks,
  particleColorButton,
  particleSpeedButton,
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


test('B-3-9 유동을 켜면 입자가 저절로 움직인다', async ({ page }) => {
  // 2026-10-26 온도 측 요청 ①(급기구 → 배기구 애니메이션). 재생을 누르지 않아도 입자는
  // 계속 움직인다 — 아무것도 누르지 않았는데 화면이 달라지면 돌고 있는 것이다.
  // 입자는 격자 데이터로 그리므로 예측·전문가·제어 모드에만 있다(현재 모드는 점 색만 바뀐다,
  // docs/01-functional-spec.md "3D 표현 규칙").
  await analysisButton(page, '유동').click();
  const canvas = detail3dCanvas(page);
  await page.waitForTimeout(2_000); // 방이 비어 있다가 급기구에서 입자가 나오기 시작한다
  const before = await snapshot(canvas);
  await expectCanvasChanged(canvas, before, '유동 입자 애니메이션');
});

test('B-3-10 입자 색을 습도로 바꾸면 범례 기준이 바뀐다', async ({ page }) => {
  // 2026-10-26 온도 측 요청 ②(입자 색 온도/습도). 색은 캔버스로 재기 어려워, 같이 바뀌는
  // 범례 눈금(온도 범위 → 습도 범위)으로 본다.
  await analysisButton(page, '유동').click();
  await expect(particleColorButton(page, '온도'), '입자 색 전환이 보이지 않습니다').toBeVisible();
  expect(await particleColorButton(page, '온도').getAttribute('aria-pressed'), '기본이 온도가 아닙니다').toBe(
    'true',
  );
  const tempTicks = await legendTicks(page);
  await particleColorButton(page, '습도').click();
  expect(await particleColorButton(page, '습도').getAttribute('aria-pressed')).toBe('true');
  await expect(async () => {
    expect(await legendTicks(page), '입자 색을 습도로 바꿨는데 범례가 그대로입니다').not.toBe(tempTicks);
  }).toPass({ timeout: 5_000 });
});

test('B-3-11 배속 1·3·10배를 고를 수 있고 기본은 10배다', async ({ page }) => {
  await analysisButton(page, '유동').click();
  for (const speed of [1, 3, 10] as const) {
    await expect(particleSpeedButton(page, speed), `${speed}배 버튼이 없습니다`).toBeVisible();
  }
  expect(await particleSpeedButton(page, 10).getAttribute('aria-pressed'), '기본 배속이 10배가 아닙니다').toBe(
    'true',
  );
  await particleSpeedButton(page, 1).click();
  expect(await particleSpeedButton(page, 1).getAttribute('aria-pressed'), '1배를 눌렀는데 선택되지 않습니다').toBe(
    'true',
  );
  expect(await particleSpeedButton(page, 10).getAttribute('aria-pressed')).toBe('false');
});
