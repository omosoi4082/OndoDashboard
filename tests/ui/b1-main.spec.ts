// B-1. 메인 화면(왼쪽) — 테스트-체크리스트.md B-1의 13개 항목.
// 항목 번호를 테스트 이름 맨 앞에 둔다(화면점검결과.txt가 이 번호로 묶어 적는다).
import { expect, test } from '@playwright/test';
import {
  ROOM_NAMES,
  bodyCursor,
  expectCanvasNotBlank,
  hoverRoom,
  mainCanvas,
  openDashboard,
  roomHoverCard,
  roomMarkerText,
  snapshot,
  unhoverRoom,
  expectCanvasChanged,
} from './helpers.js';

test.beforeEach(async ({ page }) => {
  await openDashboard(page);
});

test('B-1-1 화면을 열면 돈사 3D 모델이 보인다', async ({ page }) => {
  await expect(mainCanvas(page)).toBeVisible();
  await expectCanvasNotBlank(mainCanvas(page), '메인 3D');
});

test('B-1-2 헤더에 위치·로고·날짜와 움직이는 시계가 있다', async ({ page }) => {
  const header = page.locator('header');
  await expect(header.getByRole('img', { name: '온도' })).toBeVisible();

  const location = header.locator('span').first();
  const locationText = (await location.innerText()).trim();
  expect(locationText, '헤더 왼쪽 위치 이름이 비어 있습니다(기상청 응답의 동네 이름)').not.toBe('-');

  const clock = header.locator('time');
  const first = await clock.innerText();
  await page.waitForTimeout(1500);
  const second = await clock.innerText();
  expect(second, `시계가 멈춰 있습니다(${first})`).not.toBe(first);
});

test('B-1-3 기상청 실황 칸에 온도와 타일 4칸 값이 들어 있다', async ({ page }) => {
  const block = page.getByTestId('weather-kma');
  await expect(block).toBeVisible();
  const text = (await block.innerText()).replace(/\s+/g, ' ');
  // 타일 4칸(풍향·풍속·강수량·습도) + 온도. 값이 없으면 '-'로 찍히므로 '-' 개수로 본다.
  expect(text, `기상청 실황 값이 비어 있습니다: ${text}`).toMatch(/\d/);
  expect((text.match(/-/g) ?? []).length, `기상청 실황 값이 '-'로 비어 있습니다: ${text}`).toBeLessThan(4);
});

test('B-1-4 미세기후 칸에 온도와 타일 4칸 값이 들어 있다', async ({ page }) => {
  const block = page.getByTestId('weather-station');
  await expect(block).toBeVisible();
  const text = (await block.innerText()).replace(/\s+/g, ' ');
  expect(text, `미세기후 값이 비어 있습니다: ${text}`).toMatch(/\d/);
  expect((text.match(/-/g) ?? []).length, `미세기후 값이 '-'로 비어 있습니다: ${text}`).toBeLessThan(4);
});

test('B-1-5 두 칸의 풍속이 비슷하다(3배 이상 차이나면 실패)', async ({ page }) => {
  // 풍속 타일만 m/s 단위를 쓴다 — 블록마다 하나씩 있다(05-open-questions.md #43).
  const read = async (testId: string): Promise<number> => {
    const raw = await page.getByTestId(testId).getByText(/m\/s$/).first().innerText();
    const n = Number(raw.replace(/[^\d.]/g, ''));
    expect(Number.isFinite(n), `${testId} 풍속을 읽지 못했습니다: ${raw}`).toBe(true);
    return n;
  };
  const kma = await read('weather-kma');
  const station = await read('weather-station');
  if (kma === 0 && station === 0) return; // 둘 다 무풍이면 비교 대상이 없다
  const ratio = Math.max(kma, station) / Math.max(Math.min(kma, station), 0.1);
  expect(ratio, `기상청 ${kma} m/s 와 미세기후 ${station} m/s 가 ${ratio.toFixed(1)}배 차이납니다`).toBeLessThan(3);
});

test('B-1-6 방 3개 이름표가 보인다', async ({ page }) => {
  for (const name of Object.values(ROOM_NAMES)) {
    await expect(roomMarkerText(page, name), `${name} 이름표가 보이지 않습니다`).toBeVisible();
  }
});

test('B-1-7 자돈방에 마우스를 올리면 정보 카드가 뜬다', async ({ page }) => {
  await hoverRoom(page, ROOM_NAMES.nh);
  const card = roomHoverCard(page);
  await expect(card).toBeVisible();
  const text = (await card.innerText()).replace(/\s+/g, ' ');
  for (const row of ['온도', '습도', '환기량', 'NH3', 'CO2']) {
    expect(text, `정보 카드에 ${row} 줄이 없습니다: ${text}`).toContain(row);
  }
});

test('B-1-8 육성돈방·비육돈방에도 정보 카드가 뜬다', async ({ page }) => {
  for (const name of [ROOM_NAMES.gh, ROOM_NAMES.fh]) {
    await unhoverRoom(page);
    await hoverRoom(page, name);
    const text = (await roomHoverCard(page).locator('..').innerText()).replace(/\s+/g, ' ');
    expect(text, `${name} 정보 카드가 아니라 다른 내용이 떴습니다: ${text}`).toContain(name);
  }
});

test('B-1-9 마우스를 치우면 카드가 사라지고 이름표로 돌아간다', async ({ page }) => {
  await hoverRoom(page, ROOM_NAMES.nh);
  await expect(roomHoverCard(page)).toBeVisible();
  await unhoverRoom(page);
  await expect(roomHoverCard(page)).toBeHidden();
  await expect(roomMarkerText(page, ROOM_NAMES.nh)).toBeVisible();
});

test('B-1-10 자돈방 위에서는 커서가 손가락 모양이다', async ({ page }) => {
  await hoverRoom(page, ROOM_NAMES.nh);
  expect(await bodyCursor(page), '자돈방은 클릭 대상이라 커서가 pointer여야 합니다').toBe('pointer');
});

test('B-1-11 육성·비육돈방 위에서는 커서가 그대로다', async ({ page }) => {
  for (const name of [ROOM_NAMES.gh, ROOM_NAMES.fh]) {
    await unhoverRoom(page);
    await hoverRoom(page, name);
    expect(await bodyCursor(page), `${name}은 클릭 대상이 아니라 커서가 바뀌면 안 됩니다`).toBe('default');
  }
});

test('B-1-12 마우스로 끌면 돈사가 회전한다', async ({ page }) => {
  const canvas = mainCanvas(page);
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const before = await snapshot(canvas);
  const cx = box!.x + box!.width * 0.35;
  const cy = box!.y + box!.height * 0.55;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 260, cy + 40, { steps: 12 });
  await page.mouse.up();
  await expectCanvasChanged(canvas, before, '왼쪽 버튼 드래그(회전)');
});

test('B-1-13 휠을 굴리면 확대·축소되고 축척 숫자가 바뀐다', async ({ page }) => {
  const canvas = mainCanvas(page);
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  // 축척(8)은 "<숫자>m + 막대"다. 막대 폭(style.width)도 같이 바뀌므로 HTML째로 비교한다.
  const scaleBar = page.getByTestId('scale-bar');
  const scaleBefore = await scaleBar.innerHTML();
  const before = await snapshot(canvas);
  await page.mouse.move(box!.x + box!.width * 0.4, box!.y + box!.height * 0.5);
  for (let i = 0; i < 5; i += 1) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(120);
  }
  await expectCanvasChanged(canvas, before, '휠 확대·축소');
  await expect(async () => {
    expect(await scaleBar.innerHTML(), '축척 막대가 그대로입니다').not.toBe(scaleBefore);
  }).toPass({ timeout: 8_000 });
});
