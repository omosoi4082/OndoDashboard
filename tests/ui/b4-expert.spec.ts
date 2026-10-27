// B-4. 전문가 모드 — 테스트-체크리스트.md B-4의 16개 항목.
// 15·16은 2026-10-18에 고친 "뒤로 가기는 취소" 동작을 지키는 항목이다(ExpertModeView.tsx).
import { expect, test } from '@playwright/test';
import {
  detail3dCanvas,
  expectCanvasNotBlank,
  expertApplyButton,
  expertBackButton,
  expertCell,
  expertEditButton,
  expertExampleButton,
  expertResetButton,
  expertTableValues,
  fillExpertTable,
  openDashboard,
  openExpertInput,
  playButton,
  resetAndPause,
  timelineResetButton,
  sliderIndex,
  timelineSlider,
  waitForDetail3D,
} from './helpers.js';

test.beforeEach(async ({ page }) => {
  await openDashboard(page);
  await openExpertInput(page);
});

/** 72칸을 채우고 적용해 결과 화면까지 간다(B-4-9 이후 항목의 공통 준비).
 *  채우기는 2026-10-19에 생긴 "예시값" 버튼을 쓴다 — 손으로 치는 경로는 B-4-5~8에서 따로 본다. */
async function applyAndWaitResult(page: Parameters<typeof fillExpertTable>[0]): Promise<void> {
  await expertExampleButton(page).click();
  await expect(expertApplyButton(page)).toBeEnabled();
  await expertApplyButton(page).click();
  await expect(expertEditButton(page)).toBeVisible({ timeout: 120_000 });
  await waitForDetail3D(page);
}

test('B-4-1 전문가 모드 탭을 누르면 입력 표가 나온다', async ({ page }) => {
  await expect(page.getByText('필수값 설정')).toBeVisible();
  await expect(expertCell(page, '0시', '온도')).toBeVisible();
});

test('B-4-2 0시~23시 24줄이 모두 빈 칸으로 시작한다', async ({ page }) => {
  await expect(page.getByText('23시', { exact: true })).toBeVisible();
  const values = await expertTableValues(page);
  expect(values.length, `입력 칸이 72개가 아닙니다(${values.length}개)`).toBe(72);
  expect(values.every((v) => v === ''), '처음부터 값이 들어 있는 칸이 있습니다').toBe(true);
  await expect(expertCell(page, '0시', '온도')).toHaveAttribute('placeholder', '값을 입력해주세요.');
});

test('B-4-3 열 제목이 시간·온도·습도·환기량이다', async ({ page }) => {
  for (const title of ['시간', '온도(℃)', '습도(%)', '환기량(%)']) {
    await expect(page.getByText(title, { exact: true }), `열 제목 "${title}"이 없습니다`).toBeVisible();
  }
});

test('B-4-4 처음에는 적용이 비활성이고 초기화 대신 예시값 버튼이 있다', async ({ page }) => {
  await expect(expertApplyButton(page)).toBeDisabled();
  await expect(expertResetButton(page)).toHaveCount(0);
  await expect(expertExampleButton(page), '빈 표에 예시값 버튼이 없습니다').toBeVisible();
});

test('B-4-5 값을 하나 넣으면 예시값이 초기화 버튼으로 바뀐다', async ({ page }) => {
  await expertCell(page, '0시', '온도').fill('25');
  await expect(expertResetButton(page)).toBeVisible();
  await expect(expertExampleButton(page), '값을 넣었는데 예시값 버튼이 남아 있습니다').toHaveCount(0);
});

test('B-4-6 범위를 벗어난 값은 칸이 빨개지고 아래에 안내가 뜬다', async ({ page }) => {
  const cell = expertCell(page, '0시', '온도');
  await cell.fill('60');
  await expect(cell).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(/의 값을 입력해 주세요\./).first()).toBeVisible();
});

test('B-4-7 올바른 값으로 고치면 빨간 표시가 사라진다', async ({ page }) => {
  const cell = expertCell(page, '0시', '온도');
  await cell.fill('60');
  await expect(cell).toHaveAttribute('aria-invalid', 'true');
  await cell.fill('25');
  await expect(cell).toHaveAttribute('aria-invalid', 'false');
  await expect(page.getByText(/의 값을 입력해 주세요\./)).toHaveCount(0);
});

test('B-4-8 예시값을 누르면 72칸이 한 번에 채워지고 적용이 활성화된다', async ({ page }) => {
  await expect(expertApplyButton(page)).toBeDisabled();
  await expertExampleButton(page).click();
  const values = await expertTableValues(page);
  expect(values.filter((v) => v !== '').length, '예시값을 눌렀는데 빈 칸이 남았습니다').toBe(72);
  expect(values[0], '1행 온도가 온도 측 예시값(32.4)이 아닙니다').toBe('32.4');
  await expect(expertApplyButton(page), '예시값을 채웠는데 적용이 눌리지 않습니다').toBeEnabled();
  // 채운 뒤에는 그 자리가 시안대로 "초기화"다.
  await expect(expertResetButton(page)).toBeVisible();
  await expect(expertExampleButton(page)).toHaveCount(0);
});

test('B-4-8b 손으로 72칸을 모두 채워도 적용 버튼이 활성화된다', async ({ page }) => {
  await expect(expertApplyButton(page)).toBeDisabled();
  await fillExpertTable(page);
  await expect(expertApplyButton(page), '72칸을 채웠는데 적용이 눌리지 않습니다').toBeEnabled();
});

test('B-4-9 적용을 누르면 결과 화면으로 바뀐다', async ({ page }) => {
  await applyAndWaitResult(page);
  await expectCanvasNotBlank(detail3dCanvas(page), '전문가 모드 결과 3D');
  await expect(timelineSlider(page)).toBeVisible();
});

test('B-4-10 결과 화면 맨 위에 필수값 수정 버튼이 있다', async ({ page }) => {
  await applyAndWaitResult(page);
  await expect(page.getByText('필수값 설정')).toBeVisible();
  await expect(expertEditButton(page)).toBeVisible();
});

test('B-4-11 타임라인 라벨이 00:00~24:00이고 재생된다', async ({ page }) => {
  await applyAndWaitResult(page);
  await expect(page.getByText('00:00', { exact: true })).toBeVisible();
  await expect(page.getByText(/\/ 24:00$/)).toBeVisible();
  // 결과가 뜨면 바로 재생된다(2026-10-27) — ▶ 동작을 보려면 먼저 멈춘다.
  await resetAndPause(page);
  await playButton(page).click();
  await expect(async () => {
    expect(await sliderIndex(page), '재생을 눌렀는데 막대가 움직이지 않습니다').toBeGreaterThan(0);
  }).toPass({ timeout: 10_000 });
});

test('B-4-12 필수값 수정을 누르면 입력 표로 돌아가고 뒤로 가기가 생긴다', async ({ page }) => {
  await applyAndWaitResult(page);
  await expertEditButton(page).click();
  await expect(expertCell(page, '0시', '온도')).toBeVisible();
  await expect(expertBackButton(page)).toBeVisible();
});

test('B-4-13 뒤로 가기를 누르면 결과 화면으로 돌아간다', async ({ page }) => {
  await applyAndWaitResult(page);
  await expertEditButton(page).click();
  await expertBackButton(page).click();
  await expect(expertEditButton(page)).toBeVisible();
});

test('B-4-14 초기화를 누르면 표가 전부 빈 칸이 된다', async ({ page }) => {
  await applyAndWaitResult(page);
  await expertEditButton(page).click();
  await expertResetButton(page).click();
  const values = await expertTableValues(page);
  expect(values.every((v) => v === ''), '초기화했는데 값이 남아 있는 칸이 있습니다').toBe(true);
  await expect(expertExampleButton(page), '빈 표로 돌아왔는데 예시값 버튼이 없습니다').toBeVisible();
});

test('B-4-15 빈 상태에서도 뒤로 가기로 결과 화면에 돌아간다', async ({ page }) => {
  await applyAndWaitResult(page);
  await expertEditButton(page).click();
  await expertResetButton(page).click();
  await expertBackButton(page).click();
  await expect(expertEditButton(page)).toBeVisible();
});

test('B-4-16 다시 들어가면 적용했던 값이 그대로 차 있다', async ({ page }) => {
  await applyAndWaitResult(page);
  const applied = await (async (): Promise<string[]> => {
    await expertEditButton(page).click();
    const values = await expertTableValues(page);
    await expertBackButton(page).click();
    return values;
  })();

  // 비운 뒤 뒤로 갔다가 다시 들어와도 적용값이 돌아와 있어야 한다(2026-10-18 수정).
  await expertEditButton(page).click();
  await expertResetButton(page).click();
  await expertBackButton(page).click();
  await expertEditButton(page).click();

  const restored = await expertTableValues(page);
  expect(restored.some((v) => v !== ''), '뒤로 갔다 돌아오니 표가 빈 칸입니다(적용값이 돌아와야 합니다)').toBe(true);
  expect(restored, '돌아온 값이 적용했던 값과 다릅니다').toEqual(applied);
});
