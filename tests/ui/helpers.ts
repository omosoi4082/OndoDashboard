// 화면 자동 점검 공용 도구 — 선택자와 "3D가 바뀌었는지" 판정을 한곳에 모은다.
//
// 선택자 방침: **체크리스트에 적힌 한국어 문구를 그대로 찾는다.** 사람이 "분석 항목에서
// 습도를 클릭"하는 것과 테스트가 보는 것이 같아야, 문구가 바뀌면 둘 다 같이 바뀐다.
// 텍스트가 없는 요소(색 범례, 3D 배경 레이어)에만 data-testid를 쓴다.
//
// 3D 판정 방침: 캔버스 안은 DOM이 없어 "색이 바뀌었다"를 직접 읽을 수 없다. 캔버스 영역을
// 찍어 **픽셀이 달라졌는지**로 본다(expectCanvasChanged). 바뀐 내용이 맞는지까지는 못 보지만,
// "눌렀는데 아무 일도 안 일어난다"는 가장 흔한 고장은 이걸로 잡힌다.
import { expect, type Locator, type Page } from '@playwright/test';

export const ROOM_NAMES = { nh: '자돈방', gh: '육성돈방', fh: '비육돈방' } as const;

/** 메인 3D 배경 레이어(App.tsx) — 방 이름표·정보 카드가 이 안에 drei <Html>로 들어온다. */
export function mainScene(page: Page): Locator {
  return page.getByTestId('main-scene');
}

export function mainCanvas(page: Page): Locator {
  return mainScene(page).locator('canvas').first();
}

/** 방 이름표(호버 전) 또는 정보 카드(호버 중)의 방 이름. 둘 다 같은 자리에 뜬다. */
export function roomMarkerText(page: Page, name: string): Locator {
  return mainScene(page).getByText(name, { exact: true });
}

/** 호버 정보 카드(5-1~5-3) — NH3 줄이 있는 쪽이 카드다(이름표에는 없다). 한 번에 하나만 뜬다. */
export function roomHoverCard(page: Page): Locator {
  return mainScene(page).locator('dl').filter({ hasText: 'NH3' }).first();
}

/** 상세 패널 모드 탭. */
export function modeTab(page: Page, label: string): Locator {
  return page.getByRole('button', { name: label, exact: true });
}

/** "분석 항목" 줄의 온도/습도 버튼(2026-10-28 '유동'을 뺐다 — 입자가 늘 보인다). */
export function analysisButton(page: Page, label: '온도' | '습도'): Locator {
  return page.getByRole('button', { name: label, exact: true });
}

/** "3D 자돈방" 섹션(제목 줄 + 뷰 박스). */
export function detail3dSection(page: Page): Locator {
  return page.locator('section').filter({ hasText: '3D 자돈방' });
}

export function detail3dCanvas(page: Page): Locator {
  return detail3dSection(page).locator('canvas').first();
}

/** 3D 안 오른쪽 범례 아래에 겹친 2D 수평단면 그림(2026-10-28부터 — 전에는 아래 "2D 수평단면" 칸). */
export function detail2dSection(page: Page): Locator {
  return page.getByTestId('detail-section');
}

export function detail2dCanvas(page: Page): Locator {
  return detail2dSection(page).locator('canvas').first();
}

/** "포인트 표시" 토글(sr-only 체크박스). 클릭은 라벨 글씨("포인트 표시")로 한다. */
export function pointsToggle(page: Page): Locator {
  return page.locator('input[role="switch"]').first();
}

/** 상세 패널에 떠 있는 빨간 오류 문구(없으면 null). 로딩이 끝나지 않는 원인을 바로 알려 준다. */
export async function detailErrorText(page: Page): Promise<string | null> {
  const error = page.locator('.text-red-300').first();
  if (!(await error.isVisible().catch(() => false))) return null;
  return (await error.innerText()).replace(/\s+/g, ' ').trim();
}

/**
 * 상세 패널 3D가 데이터와 함께 뜰 때까지 기다린다. 색 범례(detail-legend)는 range가 있을
 * 때만 그려지므로 "데이터가 들어왔다"의 가장 정확한 신호다. 기다리는 동안 오류 문구가
 * 뜨면 그 문구를 그대로 실패 사유로 올린다(무인 테스트에서 원인 추적의 단서가 된다).
 */
export async function waitForDetail3D(page: Page, timeout = 120_000): Promise<void> {
  const legend = page.getByTestId('detail-legend');
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await legend.isVisible().catch(() => false)) {
      await page.waitForTimeout(400); // 첫 프레임이 그려질 틈
      return;
    }
    const error = await detailErrorText(page);
    if (error) throw new Error(`상세 패널에 오류 문구가 떴습니다: ${error}`);
    await page.waitForTimeout(500);
  }
  throw new Error(`상세 패널 3D가 ${Math.round(timeout / 1000)}초 안에 뜨지 않았습니다(색 범례가 없습니다).`);
}

/** 모드 탭을 눌러 그 모드 화면이 뜰 때까지 기다린다. */
export async function openMode(page: Page, label: string): Promise<void> {
  await modeTab(page, label).click();
  await waitForDetail3D(page);
}

/** 타임라인 슬라이더(input[type=range], 투명하게 깔려 있다). */
export function timelineSlider(page: Page): Locator {
  return page.locator('input[type="range"]').first();
}

/** 재생·일시정지 토글 버튼 — 아이콘만 있어 이름이 없다. 타임라인 영역의 유일한 원형 버튼이다. */
export function playButton(page: Page): Locator {
  return page.locator('button.rounded-full').filter({ hasNot: page.locator('input') }).first();
}

/** 초기화 → 맨 처음으로 되돌린 뒤(2026-10-27부터 바로 재생된다) ⏸로 멈춘다. ▶ 동작을 보는 항목에서 쓴다. */
export async function resetAndPause(page: Page): Promise<void> {
  await timelineResetButton(page).click();
  await playButton(page).click();
}

export function timelineResetButton(page: Page): Locator {
  return page.getByRole('button', { name: '초기화', exact: true });
}

/** 메인 화면이 다 뜰 때까지 기다린다(= 체크리스트 B-1-1의 "잠시 로딩 후"). */
export async function openDashboard(page: Page, timeout = 60_000): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('불러오는 중…')).toHaveCount(0, { timeout });
  await expect(mainCanvas(page)).toBeVisible({ timeout });
  // 방 이름표가 떴다 = glb 로드와 방 배치가 끝났다.
  await expect(roomMarkerText(page, ROOM_NAMES.nh)).toBeVisible({ timeout });
}

/**
 * 방에 마우스를 올린다. 이름표 위치에서 방 중심(원형 마커)을 되짚어 노리고, 레이아웃이
 * 바뀌어도 헛되게 깨지지 않도록 후보 지점을 차례로 시도한다. 정보 카드가 뜨면 성공.
 * (이름표·카드는 pointer-events-none이라 아래 캔버스의 레이캐스트를 가리지 않는다.)
 */
export async function hoverRoom(page: Page, name: string): Promise<void> {
  const box = await roomMarkerText(page, name).boundingBox();
  if (!box) throw new Error(`${name} 이름표를 화면에서 찾지 못했습니다.`);
  const candidates = [
    // RoomInfoPanel.tsx: [원형 마커 20px][간격 8px][글상자]. 원 중심이 방 중심이다.
    { x: box.x - 18, y: box.y + 12 },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    { x: box.x - 18, y: box.y + 48 },
    { x: box.x + box.width / 2, y: box.y + 80 },
  ];
  for (const point of candidates) {
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(250);
    if (await roomHoverCard(page).isVisible()) {
      const text = (await roomHoverCard(page).locator('..').innerText()).replace(/\s+/g, ' ');
      if (text.includes(name)) return;
    }
  }
  throw new Error(`${name}에 마우스를 올렸지만 정보 카드가 뜨지 않았습니다(${candidates.length}곳 시도).`);
}

/** 방에서 마우스를 뗀다 — 캔버스 바깥(헤더 왼쪽 빈 곳)으로 옮긴다. */
export async function unhoverRoom(page: Page): Promise<void> {
  await page.mouse.move(960, 2);
  await page.waitForTimeout(300);
}

export async function bodyCursor(page: Page): Promise<string> {
  return page.evaluate(() => document.body.style.cursor || 'default');
}

/**
 * 캔버스 한 장 찍기 — 가운데 일부만 잘라 찍는다. 1920×1080 전체를 PNG로 만들면 한 장에
 * 1초쯤 걸려서, 비교를 몇 번 반복하는 동안 테스트가 느려진다. 가운데는 모델이 차지하는
 * 자리라 회전·확대·색 변경이 모두 여기 나타난다.
 */
export async function snapshot(target: Locator): Promise<Buffer> {
  const page = target.page();
  const box = await target.boundingBox();
  if (!box) throw new Error('캔버스 위치를 찾지 못했습니다.');
  const width = Math.min(box.width, 480);
  const height = Math.min(box.height, 360);
  return page.screenshot({
    clip: {
      x: box.x + (box.width - width) / 2,
      y: box.y + (box.height - height) / 2,
      width,
      height,
    },
  });
}

/** 캔버스가 달라질 때까지 기다린다. 끝까지 같으면 "눌렀는데 안 바뀐다"로 실패시킨다. */
export async function expectCanvasChanged(target: Locator, before: Buffer, what: string): Promise<void> {
  await expect(async () => {
    const after = await snapshot(target);
    expect(after.equals(before), `${what} — 3D 화면이 그대로입니다`).toBe(false);
  }).toPass({ timeout: 12_000, intervals: [400, 600, 900, 1200] });
}

/** 캔버스가 "배경 한 색"이 아닌지 — 뭔가 그려졌는지 거친 확인(PNG 용량으로 본다). */
export async function expectCanvasNotBlank(target: Locator, what: string): Promise<void> {
  const shot = await snapshot(target);
  // 단색 PNG는 같은 크기에서 극단적으로 작게 압축된다. 3D가 그려지면 수십 KB가 된다.
  expect(shot.byteLength, `${what} — 캔버스가 비어 있는 것 같습니다(${shot.byteLength} bytes)`).toBeGreaterThan(5_000);
}

/**
 * 2D 수평단면이 그려졌는지 — **용량이 아니라 픽셀과 DOM으로** 본다.
 *
 * 왜 따로 두는가: 2026-10-22 온도 측 점검에서 B-2-10만 실패했는데 화면은 정상이었다. 0.5 m
 * 층 온도가 19.79~19.90℃(차이 0.11℃)로 고르게 나와 단면 전체가 한 색으로 칠해졌고, 단색
 * PNG는 2,778 bytes로 압축돼 expectCanvasNotBlank의 5,000 bytes 기준에 걸렸다. 용량 기준은
 * "그려졌는가"가 아니라 "색이 여러 개인가"를 보고 있었던 셈이다.
 *
 * expectCanvasNotBlank는 3D 점검 여러 곳(b1·b3·b4·b5·b6)이 쓰므로 느슨하게 바꾸지 않고,
 * 2D 단면만 이 함수로 본다. 히트맵은 2D 컨텍스트라 3D(WebGL)와 달리 픽셀을 그대로 읽을 수
 * 있어서, 한 색이어도 "칠해졌다"를 정확히 판정할 수 있다.
 *
 * 보는 것(Detail2DSection.tsx의 네 부분 전부 — 전에는 히트맵 canvas 하나만 봤다):
 *  1. 히트맵 canvas — 내부 해상도가 0이 아니고 픽셀이 불투명하게 칠해졌는지.
 *     buildHeatmapImage가 모든 픽셀의 alpha를 255로 채우므로, 한 번도 그리지 않은 canvas는
 *     기본 크기(300×150)에 전부 투명으로 남아 여기서 걸린다. 색 개수는 적어 두기만 하고
 *     판정에 쓰지 않는다 — 그게 이번 오판의 원인이었다.
 *  2. 칸막이 선(겹친 SVG)  3. X·Y축 눈금(HTML 글자)  4. 색 범례 — 2026-10-28부터 단면은 범례를 따로
 *     두지 않고 3D 범례(detail-legend) 하나를 같이 읽는다. 그래서 그 범례가 보이는지를 본다.
 */
export async function expect2DSectionDrawn(page: Page, what = '2D 수평단면'): Promise<void> {
  const section = detail2dSection(page);
  const canvas = detail2dCanvas(page);
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeVisible();

  const painted = await canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const ctx = c.width > 0 && c.height > 0 ? c.getContext('2d') : null;
    if (!ctx) return { width: c.width, height: c.height, opaque: 0, total: 0, colors: 0 };
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    const colors = new Set<number>();
    let opaque = 0;
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i + 3] ?? 0) < 255) continue;
      opaque += 1;
      colors.add(((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0));
    }
    return { width: c.width, height: c.height, opaque, total: data.length / 4, colors: colors.size };
  });

  const where = `${painted.width}×${painted.height}px, 칠해진 픽셀 ${painted.opaque}/${painted.total}, 색 ${painted.colors}종`;
  expect(painted.total, `${what} — 히트맵 캔버스에 아무것도 그려지지 않았습니다(${where})`).toBeGreaterThan(0);
  // 히트맵은 격자 전체를 채우므로 정상이면 1.0이다. 한 색이어도 칠해졌으면 통과다.
  expect(painted.opaque / painted.total, `${what} — 히트맵이 칠해지지 않았습니다(${where})`).toBeGreaterThanOrEqual(0.99);

  // 칸막이 선은 수평·수직이라 <line> 하나의 bounding box가 0이 된다(Playwright는 그걸
  // "안 보임"으로 본다). 그래서 겹친 SVG 자체가 보이는지 + 선이 몇 개 있는지로 본다.
  const overlay = section.locator('svg').first();
  await expect(overlay, `${what} — 칸막이 오버레이(SVG)가 없습니다`).toBeVisible();
  const partitions = await overlay.locator('line').count();
  expect(partitions, `${what} — 칸막이 선이 없습니다`).toBeGreaterThan(0);
  await expect(
    section.getByText(/^\d+(\.\d+)?m$/),
    `${what} — 축 눈금(m)이 보이지 않습니다`,
  ).not.toHaveCount(0);
  await expect(page.getByTestId('detail-legend'), `${what} — 색 범례가 보이지 않습니다`).toBeVisible();
}

/**
 * 상세 3D 포인트에 마우스를 올린다.
 *
 * 포인트는 캔버스 안(WebGL)이라 DOM 좌표가 없다. 한 점이 10px 남짓이라 격자로 훑어 찾는다.
 * **마우스를 옮긴 뒤 잠깐 기다려야 한다** — 옮기자마자 확인하면 React가 아직 다시 그리기 전이라
 * 맞은 자리도 "안 맞았다"로 지나간다(2026-10-18, 1,170곳을 훑고도 못 찾은 원인이 이것이었다).
 * 포인트가 모여 있는 가운데 행부터 훑어서 대개 20초 안에 찾는다.
 */
export async function hoverDetailPoint(page: Page, step = 20): Promise<void> {
  const canvas = detail3dCanvas(page);
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('3D 자돈방 캔버스를 찾지 못했습니다.');

  const rows: number[] = [];
  for (let y = box.y + step / 2; y < box.y + box.height - step / 2; y += step) rows.push(y);
  const centerY = box.y + box.height / 2;
  rows.sort((a, b) => Math.abs(a - centerY) - Math.abs(b - centerY));

  const tooltipShown = (): Promise<boolean> =>
    page.evaluate(() => (document.body.innerText ?? '').includes('VALUE :'));

  for (const y of rows) {
    for (let x = box.x + step / 2; x < box.x + box.width - step / 2; x += step) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(60);
      if (await tooltipShown()) {
        await expect(detailTooltip(page)).toBeVisible();
        return;
      }
    }
  }
  throw new Error(`3D 포인트를 ${step}px 간격으로 전부 훑었지만 툴팁(X/Y/Z/VALUE)이 뜨지 않았습니다.`);
}

/** 포인트 호버 툴팁. */
export function detailTooltip(page: Page): Locator {
  return page.getByText(/^VALUE\s*:/).first();
}

/** 슬라이더 현재 인덱스. */
export async function sliderIndex(page: Page): Promise<number> {
  return Number(await timelineSlider(page).inputValue());
}

/** 타임라인 막대를 실제로 끌어 본다(fill이 아니라 마우스 드래그). 끝난 뒤 인덱스를 돌려준다. */
export async function dragTimeline(page: Page, ratio: number): Promise<number> {
  const slider = timelineSlider(page);
  const box = await slider.boundingBox();
  if (!box) throw new Error('타임라인 막대를 찾지 못했습니다.');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * ratio, y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  return sliderIndex(page);
}

// ── 전문가 모드 ────────────────────────────────────────────────────────────

/** 전문가 모드 탭을 누르고 입력 표가 뜰 때까지 기다린다(결과가 없으면 입력 화면이 먼저다). */
export async function openExpertInput(page: Page): Promise<void> {
  await modeTab(page, '전문가 모드').click();
  await expect(page.getByText('필수값 설정')).toBeVisible();
  // exact가 없으면 '10시 온도'·'20시 온도'까지 걸린다.
  await expect(expertCell(page, '0시', '온도')).toBeVisible();
}

/** 입력 칸 하나(aria-label = "<행 라벨> <항목>", 예: "0시 온도"). */
export function expertCell(page: Page, rowLabel: string, field: '온도' | '습도' | '환기량'): Locator {
  return page.getByRole('textbox', { name: `${rowLabel} ${field}`, exact: true });
}

/**
 * 24행 × 3열 = 72칸을 한 번에 채운다. 사람은 Tab을 눌러 가며 5분쯤 걸리는 일이라(체크리스트
 * B-4-8) 한 칸씩 치면 점검 시간이 그만큼 늘어난다. 여기서는 브라우저 안에서 값을 넣고 React에
 * input 이벤트를 알려 같은 결과를 만든다 — 한 칸씩 치는 조작 자체는 B-4-5~7에서 실제로 해 본다.
 * 값은 체크리스트가 제시한 범위(온도 20~30 / 습도 50~70 / 환기량 20~100)를 쓴다.
 */
export async function fillExpertTable(page: Page): Promise<void> {
  const filled = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]'));
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (!setValue) return 0;
    inputs.forEach((input, i) => {
      const row = Math.floor(i / 3);
      const value = [22 + (row % 7), 55 + (row % 11), 30 + (row % 8) * 10][i % 3] ?? 0;
      setValue.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return inputs.length;
  });
  expect(filled, `입력 칸이 72개가 아닙니다(${filled}개)`).toBe(72);
}

export function expertApplyButton(page: Page): Locator {
  return page.getByRole('button', { name: '적용', exact: true });
}

export function expertResetButton(page: Page): Locator {
  return page.getByRole('button', { name: '초기화', exact: true });
}

/** "예시값"(2026-10-19 추가) — 표가 비어 있을 때만 "초기화" 자리에 보인다. */
export function expertExampleButton(page: Page): Locator {
  return page.getByRole('button', { name: '예시값', exact: true });
}

export function expertEditButton(page: Page): Locator {
  return page.getByRole('button', { name: '필수값 수정', exact: true });
}

export function expertBackButton(page: Page): Locator {
  return page.getByRole('button', { name: '결과 화면으로 돌아가기' });
}

/** 입력 표에 지금 들어 있는 값 72개. */
export async function expertTableValues(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]')).map((i) => i.value),
  );
}

/** 콘솔 오류 수집(B-6-1) — 페이지를 만들자마자 걸어 둔다. */
export function watchConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

/** "3D 자돈방" 제목 줄의 배속 버튼(1배·3배·10배). 네 모드 모두 늘 보인다(2026-10-28). */
export function particleSpeedButton(page: Page, speed: 1 | 3 | 10): Locator {
  return detail3dSection(page).getByRole('button', { name: `${speed}배`, exact: true });
}

/** 색 범례에 적힌 눈금 값들(공백 정리한 한 줄). 분석 항목을 습도로 바꾸면 이 값이 온도 범위에서
 * 습도 범위로 바뀌므로, 입자 색이 실제로 다른 기준을 따르는지 글자로 확인할 수 있다. */
export async function legendTicks(page: Page): Promise<string> {
  return (await page.getByTestId('detail-legend').innerText()).replace(/\s+/g, ' ').trim();
}
