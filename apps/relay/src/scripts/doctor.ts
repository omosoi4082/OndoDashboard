/**
 * 상태 점검 스크립트 (`npm run doctor`, `check.bat`) — M7-2.
 *
 * 2026-10-23 온도 측 테스트에는 사용자가 자리에 없다. 오류가 나도 피드백이 오지 않으므로
 * "사람이 보고 판단"하는 점검은 쓸 수 없다 — 이 스크립트가 항목별로 ✅/❌와 **원인·조치**를
 * 직접 찍어 준다. 출력은 그대로 `테스트-체크리스트.md`의 A부(자동 점검) 판정이 된다.
 *
 * 점검 방식: 띄워 둔 중계 서버의 HTTP API를 그대로 호출한다. 클라이언트를 여기서 다시 조립하지
 * 않는 이유는 ① index.ts의 배선을 복제하면 둘이 갈라질 수 있고 ② 대시보드가 실제로 보는 경로
 * (라우트 + 변환 + 상위 서버)를 끝까지 통과시켜야 테스트에 의미가 있기 때문이다.
 *
 * .env 검사만 서버 없이 먼저 한다 — 필수값이 비면 서버가 아예 뜨지 않아서, 그 상태로 HTTP를
 * 찔러도 "연결 안 됨"만 나오고 진짜 원인(설정 누락)이 안 보인다.
 */
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ApiResponse, Geometry, Health, KmaWeather, RoomsResponse, StationWeather } from '@ondo/shared';
import type { ControlDetail, CurrentDetail, ExpertDetail, ForecastDetail } from '@ondo/shared';
import { parseEnvFile } from '../utils/envFile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../../');
const envPath = path.join(repoRoot, '.env');

/**
 * 납품본에는 `테스트-체크리스트.md`가 없다(점검 도구를 뺀다 — docs/08-development.md). 판정 문구가
 * 그 파일을 가리키면 받는 쪽이 없는 파일을 찾게 되므로, 있을 때만 체크리스트로 안내한다
 * (2026-10-29 — bat의 install.bat 안내를 10/22에 같은 이유로 바꿨다).
 */
const hasChecklist = existsSync(path.join(repoRoot, '테스트-체크리스트.md'));

/** 서버가 안 떠 있을 때는 빨리 포기한다(기본 타임아웃은 상위 서버 호출용으로 길다). */
const CONNECT_TIMEOUT_MS = 5_000;
/** 상세 API는 연산 서버를 거치므로 오래 걸린다(예측 ~30초, 재시도가 끼면 더). */
const DETAIL_TIMEOUT_MS = 180_000;

// ── 출력 도우미 ────────────────────────────────────────────────────────────

type Level = 'ok' | 'fail' | 'warn' | 'info';

let failCount = 0;
let warnCount = 0;

function line(level: Level, text: string): void {
  const mark = { ok: '✅', fail: '❌', warn: '⚠️ ', info: 'ℹ️ ' }[level];
  if (level === 'fail') failCount += 1;
  if (level === 'warn') warnCount += 1;
  console.log(`  ${mark} ${text}`);
}

/** 실패·경고에만 붙이는 원인·조치. 온도 측이 스스로 조치할 수 있는 문장으로 쓴다. */
function why(cause: string, action: string): void {
  console.log(`      원인: ${cause}`);
  console.log(`      조치: ${action}`);
}

function section(title: string): void {
  console.log('');
  console.log(`▌${title}`);
}

function rule(): void {
  console.log('═'.repeat(70));
}

// ── .env 검사 (서버 없이) ──────────────────────────────────────────────────

/** 비면 서버가 아예 뜨지 않는 값들(config/env.ts에 default가 없다). */
const REQUIRED_KEYS = ['SENSOR_BASE_URL', 'FARM_LAT', 'FARM_LON', 'KMA_NX', 'KMA_NY'] as const;

interface EnvCheck {
  ok: boolean;
  env: Map<string, string>;
}

function checkEnv(): EnvCheck {
  section('[1/7] 설정 파일 (.env)');

  if (!existsSync(envPath)) {
    line('fail', `.env 파일이 없습니다 (${envPath})`);
    why(
      '설정 파일이 전달 패키지에 빠졌거나 다른 폴더에 있습니다. 이 파일이 없으면 중계 서버가 아예 뜨지 않습니다.',
      'setup.bat을 실행해 설정을 만드세요. 전달받은 .env 파일이 따로 있으면 이 폴더(저장소 루트)에 복사하세요.',
    );
    return { ok: false, env: new Map() };
  }
  line('ok', '.env 파일 있음');

  const env = parseEnvFile(readFileSync(envPath, 'utf8'));
  const missing = REQUIRED_KEYS.filter((k) => (env.get(k) ?? '') === '');
  if (missing.length > 0) {
    line('fail', `필수 설정이 비어 있습니다: ${missing.join(', ')}`);
    why(
      '이 값들은 기본값이 없어서, 비어 있으면 중계 서버가 시작하지 못하고 바로 종료됩니다.',
      'setup.bat을 실행해 값을 채우세요.',
    );
    return { ok: false, env };
  }
  line('ok', `필수 설정 ${REQUIRED_KEYS.length}개 모두 채워져 있음`);

  if ((env.get('KMA_SERVICE_KEY') ?? '') === '') {
    line('fail', '기상청 서비스키(KMA_SERVICE_KEY)가 비어 있습니다');
    why(
      '서버는 뜨지만 기상청 조회가 전부 실패합니다 — 화면의 외부환경(기상청 실황)이 끊김으로 표시되고, 현재·예측 모드도 외기 온·습도를 못 받아 결과가 나오지 않습니다.',
      'setup.bat을 실행해 기상청 서비스키를 넣으세요. 전달받은 .env에 키가 들어 있어야 정상입니다.',
    );
  } else {
    line('ok', '기상청 서비스키 있음');
  }

  const sensorMode = env.get('SENSOR_MODE') || 'live';
  if (sensorMode === 'mock') {
    line('warn', '센서 서버가 mock(픽스처) 모드입니다 — 실제 센서 값이 아닙니다');
    why('SENSOR_MODE=mock으로 설정돼 있습니다.', '실제 센서 서버로 테스트하려면 setup.bat에서 live로 바꾸세요.');
  } else {
    line('ok', `센서 서버 모드: live (${env.get('SENSOR_BASE_URL') ?? ''})`);
  }

  const computeMode = env.get('COMPUTE_MODE') || 'mock';
  if (computeMode === 'mock') {
    line('warn', '연산 서버가 mock(목업 파일) 모드입니다 — 실제 연산 결과가 아닙니다');
    why(
      'COMPUTE_MODE=mock으로 설정돼 있습니다. 연산 서버 주소를 받기 전 기본값입니다.',
      '연산 서버 주소를 받았으면 setup.bat에서 연산 서버 모드를 http로 바꾸고 주소를 넣으세요.',
    );
  } else {
    line('ok', `연산 서버 모드: http (${env.get('COMPUTE_BASE_URL') ?? ''})`);
  }
  // v1.3.3 가시화 데이터(2026-10-27). 꺼져 있어도 정상 — 유동 입자가 288점으로 그려질 뿐이다.
  line(
    'ok',
    env.get('COMPUTE_VIZ') === 'true'
      ? '가시화 데이터(viz): 켜짐 — 연산 서버가 v1.3.3 이상이어야 합니다'
      : '가시화 데이터(viz): 꺼짐 — 유동 입자는 288점으로 그립니다 (켜려면 setup.bat [2/3])',
  );

  return { ok: true, env };
}

// ── HTTP 도우미 ────────────────────────────────────────────────────────────

interface Fetched<T> {
  ok: boolean;
  httpStatus: number;
  body: T | null;
  /** 네트워크·타임아웃·JSON 파싱 실패 사유. 성공이면 null. */
  problem: string | null;
}

async function getJson<T>(baseUrl: string, pathname: string, timeoutMs: number): Promise<Fetched<T>> {
  return requestJson<T>(baseUrl, pathname, timeoutMs, undefined);
}

async function postJson<T>(baseUrl: string, pathname: string, timeoutMs: number, body: unknown): Promise<Fetched<T>> {
  return requestJson<T>(baseUrl, pathname, timeoutMs, body);
}

async function requestJson<T>(
  baseUrl: string,
  pathname: string,
  timeoutMs: number,
  body: unknown | undefined,
): Promise<Fetched<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${pathname}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    try {
      return { ok: res.ok, httpStatus: res.status, body: JSON.parse(text) as T, problem: null };
    } catch {
      return { ok: false, httpStatus: res.status, body: null, problem: 'JSON이 아닌 응답을 받았습니다' };
    }
  } catch (err) {
    const problem =
      err instanceof Error && err.name === 'AbortError'
        ? `${Math.round(timeoutMs / 1000)}초 안에 응답이 없었습니다`
        : err instanceof Error
          ? err.message
          : '알 수 없는 오류';
    return { ok: false, httpStatus: 0, body: null, problem };
  } finally {
    clearTimeout(timer);
  }
}

/** ApiResponse의 error.message를 사람이 읽을 문구로. */
function apiErrorText(body: unknown): string {
  if (body !== null && typeof body === 'object' && 'error' in body) {
    const e = (body as { error?: { code?: string; source?: string; message?: string } }).error;
    if (e) return `${e.message ?? ''} (code ${e.code ?? '?'}, source ${e.source ?? '?'})`;
  }
  return '응답 형식이 예상과 다릅니다';
}

// ── 중계 서버 ──────────────────────────────────────────────────────────────

async function checkRelay(baseUrl: string): Promise<boolean> {
  section('[2/7] 중계 서버');

  // 생존 확인은 **정적 화면(/)으로** 한다. /api/health를 쓰면 안 된다 — 그 라우트는 상위 서버
  // 셋을 함께 찍어서 연산 서버가 꺼져 있거나 주소가 틀리면 UPSTREAM_TIMEOUT_MS(10초)를 다
  // 기다린다. 5초 타임아웃으로 그것을 생존 확인에 쓰면 서버가 멀쩡히 떠 있는데도
  // "서버가 안 떠 있습니다"로 잘못 진단하고 남은 점검(3~7)까지 건너뛴다(2026-10-21 실측 12초).
  // 상위 서버 상태는 [7/7]에서 따로 요약한다.
  const root = await getJson<unknown>(baseUrl, '/', CONNECT_TIMEOUT_MS);
  if (root.httpStatus === 0) {
    line('fail', `중계 서버에 연결할 수 없습니다 (${baseUrl})`);
    why(
      `서버가 떠 있지 않거나 다른 포트를 쓰고 있습니다. (${root.problem ?? '응답 없음'})`,
      'start.bat을 먼저 실행해 서버를 띄우고, 창을 닫지 않은 상태에서 다시 check.bat을 실행하세요.',
    );
    return false;
  }
  line('ok', `중계 서버 응답함 (${baseUrl})`);

  // 대시보드 index.html은 JSON이 아니므로 "JSON 파싱 실패 + 2xx"가 정상 신호다.
  if (root.httpStatus >= 200 && root.httpStatus < 300) {
    line('ok', `대시보드 화면 서빙됨 — 브라우저에서 ${baseUrl} 을 열면 화면이 나옵니다`);
  } else {
    line('fail', '대시보드 화면이 서빙되지 않습니다 (API만 떠 있습니다)');
    why(
      '대시보드 빌드 결과(apps/dashboard/dist)가 없습니다.',
      'install.bat을 실행해 빌드하세요. 빌드까지 끝낸 패키지를 받았다면 압축이 일부만 풀렸을 수 있습니다.',
    );
  }
  return true;
}

// ── 상위 서버 3종 ──────────────────────────────────────────────────────────

async function checkSensor(baseUrl: string): Promise<void> {
  section('[3/7] 센서 서버 (온도 제공)');

  const res = await getJson<ApiResponse<RoomsResponse>>(baseUrl, '/api/main/rooms', CONNECT_TIMEOUT_MS * 4);
  if (res.body === null || res.body.status === 'error') {
    line('fail', '센서 서버 조회가 실패했습니다');
    why(
      res.body === null ? (res.problem ?? '응답 없음') : apiErrorText(res.body),
      '센서 서버 주소(SENSOR_BASE_URL)가 맞는지, 이 PC에서 센서 서버에 접근할 수 있는지 확인하세요. 같은 공유기에 있어야 합니다.',
    );
    return;
  }

  const rooms = res.body.data;
  const names: Record<keyof RoomsResponse, string> = { NH: '자돈방', GH: '육성돈방', FH: '비육돈방' };
  for (const id of ['NH', 'GH', 'FH'] as const) {
    const room = rooms[id];
    if (room === undefined) {
      line('fail', `${names[id]} 데이터가 응답에 없습니다`);
      why('중계 서버가 방 정보를 만들지 못했습니다.', '이 문구를 그대로 개발자에게 전달하세요.');
      continue;
    }
    if (room.sourceStatus !== 'ok') {
      line('fail', `${names[id]} 센서가 끊김입니다`);
      why(
        '이 방의 센서 조회가 실패했습니다. 화면에서도 이 방만 끊김으로 표시됩니다.',
        '센서 서버에서 해당 방 장비가 켜져 있는지 확인하세요. 다른 방이 정상이면 중계 서버 문제는 아닙니다.',
      );
      continue;
    }
    const miss = (['temp', 'rh', 'fanRate', 'nh3', 'co2'] as const).filter((k) => room[k] === null);
    if (miss.length > 0) {
      line('warn', `${names[id]} 정상 — 다만 값이 빈 항목: ${miss.join(', ')}`);
      why('센서는 응답했지만 그 항목 값이 없습니다.', '해당 센서 항목이 실제로 설치·동작 중인지 온도 측에서 확인해 주세요.');
    } else {
      line(
        'ok',
        `${names[id]} 정상 — 온도 ${room.temp}℃ / 습도 ${room.rh}% / 환기량 ${room.fanRate}% / NH3 ${room.nh3} / CO2 ${room.co2}`,
      );
    }
  }

  const station = await getJson<ApiResponse<StationWeather>>(baseUrl, '/api/main/weather/station', CONNECT_TIMEOUT_MS * 4);
  if (station.body === null || station.body.status === 'error' || station.body.data.sourceStatus !== 'ok') {
    line('fail', '기상대 센서(미세기후)가 끊김입니다');
    why(
      station.body === null ? (station.problem ?? '응답 없음') : '기상대 센서(JE/OU/WS/WS1) 조회가 실패했습니다.',
      '화면 외부환경의 미세기후 칸만 끊김으로 표시됩니다. 센서 서버에서 기상대 장비 상태를 확인하세요.',
    );
  } else {
    const d = station.body.data;
    line('ok', `기상대 센서 정상 — 온도 ${d.temp}℃ / 습도 ${d.rh}% / 풍속 ${d.windSpeed}m/s / 강수 ${d.rain}mm`);
  }
}

async function checkKma(baseUrl: string): Promise<void> {
  section('[4/7] 기상청 (단기예보 조회서비스)');

  const res = await getJson<ApiResponse<KmaWeather>>(baseUrl, '/api/main/weather/kma', CONNECT_TIMEOUT_MS * 4);
  if (res.body === null || res.body.status === 'error' || res.body.data.sourceStatus !== 'ok') {
    line('fail', '기상청 실황 조회가 실패했습니다');
    why(
      res.body === null ? (res.problem ?? '응답 없음') : '기상청 초단기실황을 받지 못했습니다.',
      '① 기상청 서비스키가 맞는지(setup.bat) ② 이 PC가 인터넷에 연결돼 있는지 ③ 공공데이터포털에서 "단기예보 조회서비스" 활용 신청이 승인됐는지 확인하세요. 기상청이 점검 중일 수도 있습니다.',
    );
    return;
  }

  const d = res.body.data;
  line('ok', `기상청 실황 정상 — 온도 ${d.temp}℃ / 습도 ${d.rh}% / 풍향 ${d.windDir} / 풍속 ${d.windSpeed}m/s / 강수 ${d.rain}mm`);
  if (d.weatherCode === null) {
    line('warn', '날씨 아이콘 코드가 없습니다');
    why('초단기예보(SKY)를 받지 못해 날씨 판정을 못 했습니다.', '잠시 뒤 다시 실행해 보세요. 계속 비면 개발자에게 전달하세요.');
  } else {
    line('ok', `날씨 판정 ${d.weatherCode}${d.isNight ? ' (야간)' : ''}`);
  }
  if (d.areaName === null || d.areaName === '') {
    line('warn', '헤더에 표시할 동네 이름(FARM_AREA_NAME)이 비어 있습니다');
    why('표시용 설정값이 비어 있습니다.', '기능에는 영향이 없습니다. 동네 이름을 넣으려면 .env의 FARM_AREA_NAME을 채우세요.');
  }
}

// ── 상세 API 4개 (연산 서버 경로) ─────────────────────────────────────────

/** geometry에서 읽은 배열 개수 기준. 하드코딩하지 않는다(CLAUDE.md). */
interface Counts {
  points: number;
  grid: number;
  flow: number;
}

async function checkGeometry(baseUrl: string): Promise<Counts | null> {
  section('[5/7] 고정 형상 (돈방 치수·포인트 좌표)');

  // 이 라우트만 ApiOk로 감싸지 않고 Geometry를 그대로 돌려준다(docs/02-relay-api.md 5장).
  const res = await getJson<Geometry>(baseUrl, '/api/detail/geometry', CONNECT_TIMEOUT_MS);
  const g = res.body;
  if (!res.ok || g === null || g.grid === undefined || g.flowGrid === undefined) {
    line('fail', '형상 정보를 받지 못했습니다');
    why(
      res.problem ?? (res.body === null ? '응답 없음' : '응답에 grid·flowGrid 정의가 없습니다'),
      'config/geometry.json 파일이 있는지 확인하세요. 없으면 압축이 일부만 풀렸을 수 있습니다.',
    );
    return null;
  }

  const grid = g.grid.size[0] * g.grid.size[1] * g.grid.size[2];
  const flow = g.flowGrid.size[0] * g.flowGrid.size[1] * g.flowGrid.size[2];
  line('ok', `형상 정보 정상 — 포인트 ${g.points.length}개 / 격자 ${grid}개 / 유동 격자 ${flow}개 (${g.geometryId})`);
  return { points: g.points.length, grid, flow };
}

/** 상세 응답 한 건의 프레임·배열 개수를 형상과 맞춰 본다. */
function checkFrames(
  label: string,
  body: ApiResponse<CurrentDetail | ForecastDetail | ExpertDetail | ControlDetail> | null,
  problem: string | null,
  expectFrames: number,
  counts: Counts | null,
): void {
  if (body === null) {
    line('fail', `${label} 실패`);
    why(problem ?? '응답 없음', '서버 창에 찍힌 오류 문구와 함께 개발자에게 전달하세요.');
    return;
  }
  if (body.status === 'error') {
    line('fail', `${label} 실패`);
    const text = apiErrorText(body);
    // 연산·센서·기상청 중 어디서 막혔는지에 따라 조치가 다르다.
    const source = (body as { error: { source?: string } }).error.source;
    const action =
      source === 'compute'
        ? '연산 서버가 켜져 있는지, 주소(COMPUTE_BASE_URL)가 맞는지 확인하세요. 주소를 모르면 setup.bat에서 연산 서버 모드를 mock으로 두면 화면 확인은 됩니다.'
        : source === 'kma'
          ? '기상청 조회 문제입니다. 위 [4/7] 항목의 조치를 먼저 하세요.'
          : source === 'sensor'
            ? '센서 서버 문제입니다. 위 [3/7] 항목의 조치를 먼저 하세요.'
            : '이 문구를 그대로 개발자에게 전달하세요.';
    why(text, action);
    return;
  }

  const d = body.data;
  if (d.frames.length !== expectFrames) {
    line('fail', `${label} — 프레임 수가 ${d.frames.length}개입니다 (${expectFrames}개여야 합니다)`);
    why('연산 서버 응답의 프레임 수가 약속과 다릅니다.', '이 문구를 그대로 개발자와 온도 측 연산 담당자에게 전달하세요.');
    return;
  }

  if (counts !== null) {
    const f = d.frames[0];
    if (f !== undefined) {
      const bad: string[] = [];
      if (f.points.temp.length !== counts.points) bad.push(`포인트 ${f.points.temp.length}≠${counts.points}`);
      if (f.grid.temp.length !== counts.grid) bad.push(`격자 ${f.grid.temp.length}≠${counts.grid}`);
      if (f.flow.length !== counts.flow) bad.push(`유동 ${f.flow.length}≠${counts.flow}`);
      if (bad.length > 0) {
        line('fail', `${label} — 배열 개수가 형상과 다릅니다: ${bad.join(', ')}`);
        why('연산 서버가 보낸 값의 개수가 돈방 형상과 맞지 않습니다.', '이 문구를 그대로 개발자와 온도 측 연산 담당자에게 전달하세요.');
        return;
      }
    }
  }

  const gridFlow = d.frames[0]?.grid.flow;
  // 전문가·제어 목업은 v1.3.2 응답이라 유속이 288점이다. 실제 연산 서버가 v1.3.3이면 네 모드 모두
  // 2,584점으로 올라오므로, 목업 때문에 입자 흐름이 모드마다 달라 보이는 것임을 적어 둔다
  // (2026-10-27 사용자: 온도 측에 따로 요청하지 말고 경고로만 남긴다).
  const flowNote =
    gridFlow !== undefined
      ? `유속 ${gridFlow.length}점(viz)`
      : `유속 ${d.frames[0]?.flow.length ?? 0}점 — 목업 파일 기준입니다(실제 연산 서버 v1.3.3은 2,584점)`;
  line('ok', `${label} 정상 — 프레임 ${d.frames.length}개, 색 범위 온도 ${d.range.temp.min}~${d.range.temp.max}℃, ${flowNote}`);
}

async function checkDetail(baseUrl: string, counts: Counts | null): Promise<void> {
  section('[6/7] 상세 화면 데이터 (연산 서버 경로)');
  console.log('      ※ 연산에 시간이 걸립니다 — 예측 모드는 30초 이상 걸릴 수 있습니다. 기다려 주세요.');

  const current = await getJson<ApiResponse<CurrentDetail>>(baseUrl, '/api/detail/current', DETAIL_TIMEOUT_MS);
  checkFrames('현재 모드', current.body, current.problem, 1, counts);

  const forecast = await getJson<ApiResponse<ForecastDetail>>(baseUrl, '/api/detail/forecast', DETAIL_TIMEOUT_MS);
  checkFrames('예측 모드', forecast.body, forecast.problem, 145, counts);

  // 전문가 모드는 24행 입력이 필요하다(2026-10-13 B-2). 범위 안의 무난한 값으로 넣어 본다.
  const rows = Array.from({ length: 24 }, () => ({ temp: 22, rh: 60, vent: 50 }));
  const expert = await postJson<ApiResponse<ExpertDetail>>(baseUrl, '/api/detail/expert', DETAIL_TIMEOUT_MS, { rows });
  checkFrames('전문가 모드', expert.body, expert.problem, 145, counts);

  const control = await getJson<ApiResponse<ControlDetail>>(
    baseUrl,
    '/api/detail/control?target=energy',
    DETAIL_TIMEOUT_MS,
  );
  checkFrames('제어 모드', control.body, control.problem, 145, counts);
  if (control.body !== null && control.body.status !== 'error' && control.body.data.control === undefined) {
    line('fail', '제어 모드 — 절감률·환기량 곡선(control 블록)이 없습니다');
    why('응답에 control 블록이 빠졌습니다.', '제어 모드 화면의 요약 카드와 그래프가 비게 됩니다. 개발자에게 전달하세요.');
  }
}

// ── 상위 서버 상태 요약 ───────────────────────────────────────────────────

async function checkHealthSummary(baseUrl: string): Promise<void> {
  section('[7/7] 상위 서버 연결 상태 요약');

  // 연산 서버가 안 뜨면 health가 10초 넘게 걸린다(UPSTREAM_TIMEOUT_MS) — 여유를 둔다.
  const res = await getJson<Health>(baseUrl, '/api/health', CONNECT_TIMEOUT_MS * 6);
  if (res.body === null) {
    line('fail', '상태 요약을 받지 못했습니다');
    why(res.problem ?? '응답 없음', 'start.bat으로 서버를 다시 띄워 보세요.');
    return;
  }
  const h = res.body;
  const show = (name: string, status: string, hint: string): void => {
    if (status === 'ok') line('ok', `${name} 연결됨`);
    else {
      line('fail', `${name} 끊김`);
      why(`${name}에 연결하지 못했습니다.`, hint);
    }
  };
  show('센서 서버', h.sensor, '센서 서버 주소와 네트워크를 확인하세요 ([3/7] 참고).');
  show('기상청', h.kma, '기상청 서비스키와 인터넷 연결을 확인하세요 ([4/7] 참고).');
  show('연산 서버', h.compute, '연산 서버가 켜져 있는지, 주소가 맞는지 확인하세요. mock 모드면 항상 연결됨으로 나옵니다.');
}

// ── 실행 ──────────────────────────────────────────────────────────────────

/** 한 점검 단계를 감싼다 — 터져도 실패 1건으로 기록하고 다음 단계로 넘어간다. */
async function stepValue<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (err) {
    line('fail', '점검 중 예상하지 못한 오류가 났습니다');
    why(
      err instanceof Error ? err.message : String(err),
      '이 문구를 그대로 개발자에게 전달하세요. 나머지 항목은 계속 점검합니다.',
    );
    return fallback;
  }
}

async function step(run: () => Promise<void>): Promise<void> {
  await stepValue(run, undefined);
}

async function main(): Promise<void> {
  rule();
  console.log(' 온도 돈사 대시보드 — 상태 점검');
  console.log(` 실행 시각: ${new Date().toLocaleString('ko-KR')}`);
  rule();

  const { ok: envOk, env } = checkEnv();

  const port = env.get('PORT') || '8080';
  const baseUrl = `http://localhost:${port}`;

  if (!envOk) {
    console.log('');
    rule();
    console.log(' 판정: ❌ 설정 문제로 더 점검할 수 없습니다.');
    console.log(' 위 [1/7]의 조치를 먼저 하고 다시 실행하세요.');
    rule();
    process.exit(1);
  }

  const relayUp = await checkRelay(baseUrl);
  if (!relayUp) {
    console.log('');
    rule();
    console.log(' 판정: ❌ 중계 서버가 떠 있지 않아 더 점검할 수 없습니다.');
    console.log(' start.bat을 실행해 서버를 띄운 뒤(창을 닫지 마세요) 다시 check.bat을 실행하세요.');
    rule();
    process.exit(1);
  }

  // 각 단계를 따로 감싼다 — 예상 못 한 응답 형태로 한 단계가 터져도 나머지 점검은 계속해야
  // 한다(사용자가 없는 자리에서 "중간에 죽어서 뒤를 못 봤다"가 가장 나쁜 결과다).
  await step(() => checkSensor(baseUrl));
  await step(() => checkKma(baseUrl));
  const counts = await stepValue(() => checkGeometry(baseUrl), null);
  await step(() => checkDetail(baseUrl, counts));
  await step(() => checkHealthSummary(baseUrl));

  console.log('');
  rule();
  if (failCount === 0 && warnCount === 0) {
    console.log(
      hasChecklist
        ? ' 판정: ✅ 모두 정상입니다. 테스트-체크리스트.md의 B부(화면 조작)로 넘어가세요.'
        : ' 판정: ✅ 모두 정상입니다. 브라우저에서 화면을 확인해 주세요(README.md "화면 보는 법").',
    );
  } else if (failCount === 0) {
    console.log(` 판정: ⚠️  정상이지만 확인할 점이 ${warnCount}건 있습니다 (위 ⚠️ 표시).`);
    console.log(
      hasChecklist
        ? ' 화면 테스트는 진행할 수 있습니다. 체크리스트 B부로 넘어가세요.'
        : ' 화면은 그대로 쓸 수 있습니다. 브라우저에서 확인해 주세요.',
    );
  } else {
    console.log(` 판정: ❌ 실패 ${failCount}건${warnCount > 0 ? `, 확인할 점 ${warnCount}건` : ''}.`);
    console.log(' 위 ❌ 항목의 "조치"를 따라 하세요. 조치해도 안 되면 이 창 내용을 그대로 복사해');
    console.log(
      hasChecklist
        ? ' 개발자에게 전달하세요(테스트-체크리스트.md 맨 뒤 "오류 보고" 참고).'
        : ' 개발자에게 전달하세요(README.md "안 될 때" 참고).',
    );
  }
  rule();
  process.exit(failCount === 0 ? 0 : 1);
}

await main();
