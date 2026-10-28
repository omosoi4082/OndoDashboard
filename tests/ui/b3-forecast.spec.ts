// B-3. 예측 모드 — 테스트-체크리스트.md B-3의 12개 항목(9~11은 유동 입자 — 2026-10-28 분석 항목 온도/습도로 개편, 12는 배속·타임라인 연동).
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
  resetAndPause,
  sliderIndex,
  snapshot,
  timelineResetButton,
  timelineSlider,
  legendTicks,
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
  // 2026-10-27부터 모드에 들어가면 바로 재생된다 — ▶ 동작을 보려면 먼저 멈춰 둔다.
  await resetAndPause(page);
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
  await resetAndPause(page);
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
  // 재생 중에 끌면 끈 자리가 바로 지나가 버린다 — 멈춰 두고 본다.
  await resetAndPause(page);
  const canvas = detail3dCanvas(page);
  const before = await snapshot(canvas);
  const moved = await dragTimeline(page, 0.7);
  expect(moved, '막대를 끌었는데 위치가 그대로입니다').toBeGreaterThan(0);
  await expectCanvasChanged(canvas, before, '타임라인 드래그');
});

test('B-3-7 초기화를 누르면 맨 처음으로 돌아가 다시 재생된다', async ({ page }) => {
  // 2026-10-27 사용자: "초기화를 누르면 처음부터 재생돼야 한다"(그 전에는 일시정지와 같았다).
  await expect(async () => {
    expect(await sliderIndex(page), '모드에 들어가면 바로 재생돼야 합니다').toBeGreaterThan(0);
  }).toPass({ timeout: 10_000 });
  await timelineResetButton(page).click();
  const atReset = await sliderIndex(page);
  expect(atReset, '초기화했는데 맨 처음으로 돌아가지 않았습니다').toBeLessThanOrEqual(2);
  await expect(async () => {
    expect(await sliderIndex(page), '초기화했는데 다시 재생되지 않습니다').toBeGreaterThan(atReset);
  }).toPass({ timeout: 10_000 });
});

test('B-3-8 재생이 제 속도로 넘어간다', async ({ page }) => {
  // 설계값은 프레임당 0.5초(TIMELINE_FRAME_DURATION_MS). 3초면 6프레임 전후다.
  // 눈에 보이는 "뚝뚝 끊김"(렌더 지연)까지는 판정할 수 없다 — 사람이 볼 항목으로 남긴다.
  await resetAndPause(page);
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


test('B-3-9 입자가 저절로 움직인다', async ({ page }) => {
  // 2026-10-26 온도 측 요청 ①(급기구 → 배기구 애니메이션). 모드에 들어가면 바로 재생되고
  // 입자가 흐른다 — 아무것도 누르지 않았는데 화면이 달라지면 돌고 있는 것이다.
  // 2026-10-28부터 온도·습도 어느 쪽이든 입자가 나온다(유동 버튼 없음).
  const canvas = detail3dCanvas(page);
  await page.waitForTimeout(2_000); // 방이 비어 있다가 급기구에서 입자가 나오기 시작한다
  const before = await snapshot(canvas);
  await expectCanvasChanged(canvas, before, '유동 입자 애니메이션');
});

test('B-3-10 습도를 누르면 입자 색·범례가 습도 기준으로 바뀐다', async ({ page }) => {
  // 2026-10-28: 입자 색 = 분석 항목(입자 색 토글은 없앴다). 색은 캔버스로 재기 어려워, 같이 바뀌는
  // 범례 눈금(온도 범위 → 습도 범위)으로 본다. 입자 색 버튼이 남아 있지 않은지도 본다.
  await expect(page.getByText('입자 색', { exact: true }), '입자 색 버튼이 남아 있습니다').toHaveCount(0);
  const tempTicks = await legendTicks(page);
  await analysisButton(page, '습도').click();
  await expect(async () => {
    expect(await legendTicks(page), '습도로 바꿨는데 범례가 그대로입니다').not.toBe(tempTicks);
  }).toPass({ timeout: 5_000 });
});

test('B-3-11 배속 1·3·10배를 고를 수 있고 기본은 1배다', async ({ page }) => {
  for (const speed of [1, 3, 10] as const) {
    await expect(particleSpeedButton(page, speed), `${speed}배 버튼이 없습니다`).toBeVisible();
  }
  expect(await particleSpeedButton(page, 1).getAttribute('aria-pressed'), '기본 배속이 1배가 아닙니다').toBe('true');
  await particleSpeedButton(page, 10).click();
  expect(await particleSpeedButton(page, 10).getAttribute('aria-pressed'), '10배를 눌렀는데 선택되지 않습니다').toBe(
    'true',
  );
  expect(await particleSpeedButton(page, 1).getAttribute('aria-pressed')).toBe('false');
});

test('B-3-12 배속을 올리면 타임라인도 빨리 넘어간다', async ({ page }) => {
  // 1배 = 프레임당 0.5초, 10배 = 0.05초(2026-10-28 사용자 — 샘플 뷰어처럼 배속에 타임라인도 따른다).
  // 같은 2초 동안 1배는 약 4프레임, 10배는 약 40프레임 — 넉넉히 3배 이상 차이 나면 통과.
  const framesIn = async (ms: number): Promise<number> => {
    const start = await sliderIndex(page);
    await page.waitForTimeout(ms);
    return (await sliderIndex(page)) - start;
  };
  const slow = await framesIn(2_000);
  await particleSpeedButton(page, 10).click();
  const fast = await framesIn(2_000);
  expect(slow, '1배에서 타임라인이 움직이지 않습니다').toBeGreaterThan(0);
  expect(fast, `10배인데 타임라인이 빨라지지 않았습니다(1배 ${slow}프레임, 10배 ${fast}프레임)`).toBeGreaterThan(
    slow * 3,
  );
});
