import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// 패키지 매니저가 apps/relay를 cwd로 실행하므로, 저장소 루트의 .env를 명시적으로 가리킨다.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFilePath = path.resolve(__dirname, '../../../../.env');
loadDotenv({ path: envFilePath });

// .env.example과 항상 일치시킨다. 새 설정을 추가하면 두 파일을 같이 고친다.
// FARM_LAT/LON, KMA_NX/NY는 M1(KmaClient)부터 required로 좁힌다(docs/05-open-questions.md #12).
// KMA_SERVICE_KEY는 공공데이터포털에서 발급 전까지 빈 값일 수 있으므로 계속 optional(빈 문자열 허용) —
// 비어 있어도 서버는 뜨고, 실제 기상청 호출만 실패(disconnected)한다.
// 쉼표로 구분한 숫자 목록("22,24,26,28") → number[].
/**
 * 빈 값을 **0으로 받아들이지 않는** 필수 숫자. `z.coerce.number()`는 `''`를 0으로 바꿔서,
 * `.env`에서 값을 지워도 서버가 조용히 뜬다 — 2026-10-17 실측에서 `FARM_LAT=`로 두니
 * 위경도가 0(적도)이 된 채 정상인 척 떴다. 일출·일몰 판정과 격자 좌표가 말없이 틀어지는
 * 유형이라, 사용자가 자리에 없는 테스트에서는 특히 위험하다. 빈 문자열을 undefined로
 * 바꿔 "필수값 없음"으로 걸리게 한다.
 */
const requiredNumber = (): z.ZodEffects<z.ZodNumber, number, unknown> =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number({ invalid_type_error: '값이 비어 있거나 숫자가 아닙니다' }),
  );

const numberList = z
  .string()
  .transform((v) => v.split(',').map((x) => Number(x.trim())))
  .refine((arr) => arr.length > 0 && arr.every((n) => Number.isFinite(n)), '쉼표로 구분한 숫자 목록이어야 합니다');

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),

  SENSOR_MODE: z.enum(['live', 'mock']).default('live'),
  // 현재·예측 모드 입력용 이력(range)만 따로 전환. 비우면 SENSOR_MODE를 따른다. 지금 이력을
  // 쓰는 입력은 환기팬 하나뿐이다(외기 온·습도는 기상청 실황 — 2026-10-13 B-3, 05-open-questions #34).
  SENSOR_HISTORY_MODE: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['live', 'mock']).optional()),
  SENSOR_BASE_URL: z.string().min(1),
  INPUT_FAN_PATH: z.string().min(1).default('JE/EX/NH/FN1/FAN1'),

  KMA_SERVICE_KEY: z.string().default(''),
  FARM_LAT: requiredNumber(),
  FARM_LON: requiredNumber(),
  KMA_NX: requiredNumber().refine(Number.isInteger, '정수여야 합니다'),
  KMA_NY: requiredNumber().refine(Number.isInteger, '정수여야 합니다'),
  // 헤더 위치 표시용 동네 이름(기상청 격자 KMA_NX·NY의 예보구역). 비우면 화면에 표시 안 함.
  FARM_AREA_NAME: z.string().default(''),

  COMPUTE_MODE: z.enum(['mock', 'http']).default('mock'),
  COMPUTE_BASE_URL: z.string().min(1).default('http://localhost:9000'),
  COMPUTE_API_KEY: z.string().default(''),
  COMPUTE_API_KEY_HEADER: z.string().min(1).default('X-API-Key'),
  // 예측 입력(forecast 구간) fan_pct 5단 구간 표(docs/03 2장, 2026-10-13 B-4). 경계 기온(℃,
  // 오름차순)과 구간별 가동률(%, 경계보다 1개 많게)을 쉼표로 적는다. 경계는 아래쪽 포함.
  FAN_STEP_TEMPS: numberList.default('22,24,26,28'),
  FAN_STEP_PCTS: numberList.default('20,40,60,80,100'),

  SECTION_Z_M: z.coerce.number().default(0.5),

  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  COMPUTE_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  // 연산 서버 SERVER·BUSY 오류 시 재시도 전 대기(2026-10-13 D-4 "1분 뒤 재시도", 1회).
  // GET /v1/health(D-5)는 진단용이라 COMPUTE_TIMEOUT_MS가 아니라 UPSTREAM_TIMEOUT_MS를 쓴다.
  COMPUTE_RETRY_DELAY_MS: z.coerce.number().int().nonnegative().default(60_000),

  GEOMETRY_FILE: z.string().min(1).default('./config/geometry.json'),

  // 전문가·제어 모드 목업 파일(docs/03-upstream-apis.md 4.4, mock/README.md). 온도 측이
  // 제공한 실제 파일 경로(현재 mock/ 바로 아래, 서브폴더 없음). 파일이 없으면 해당 라우트만
  // 오류를 반환한다(서버 시작은 막지 않음 — GEOMETRY_FILE과 달리 필수 아님).
  MOCK_EXPERT_FILE: z.string().min(1).default('./mock/mock_expert.json'),
  MOCK_CONTROL_FILE: z.string().min(1).default('./mock/mock_control.json'),

  // 현재·예측 모드 목업 응답 파일(온도 측 2026-10-13 v3 제공). COMPUTE_MODE=mock일 때
  // 연산 서버 대신 이 파일을 읽는다(온도 측 C 요청). 파일이 없거나 형식이 안 맞으면
  // transforms/mockComputeGen.ts의 합성 생성기로 폴백한다(clients/mockComputeClient.ts).
  MOCK_RESPONSE_CURRENT_FILE: z.string().min(1).default('./mock/sample_response_current.json'),
  MOCK_RESPONSE_FORECAST_FILE: z.string().min(1).default('./mock/sample_response_forecast.json'),

  // 센서 5분 집계·결측 처리 (docs/03-upstream-apis.md 1.2, M4). .env.example과 기본값을 맞춘다.
  AGG_INTERP_MAX_GAP: z.coerce.number().int().nonnegative().default(3),
  AGG_ERROR_MIN_GAP: z.coerce.number().int().positive().default(4),
  AGG_ERROR_MAX_RATIO: z.coerce.number().min(0).max(1).default(0.2),
  SENSOR_TEMP_MIN: z.coerce.number().default(-30),
  SENSOR_TEMP_MAX: z.coerce.number().default(50),
  SENSOR_RH_MIN: z.coerce.number().default(0),
  SENSOR_RH_MAX: z.coerce.number().default(100),
  SENSOR_FAN_MIN: z.coerce.number().default(0),
  SENSOR_FAN_MAX: z.coerce.number().default(100),

  // 기상청 단기예보 NO_DATA 시 최신 발표분에서 최대 몇 단계 이전 발표분까지 내려갈지(발표는 3시간
  // 간격 — 3이면 23:00 → 20:00 → 17:00 → 14:00 = 최대 9시간 전 발표분). 2026-10-13 23:30 실측에서
  // 두 단계 연속 NO_DATA였고, 2026-10-15 온도 측이 3단계로 확정했다(05-open-questions.md #50).
  KMA_VILAGE_MAX_STEPS_BACK: z.coerce.number().int().nonnegative().default(3),

  // 기상청 단기예보 결측 허용 시간(docs/03 2장) — 연속 이 값(시간) 이상 결측이면 예보 조회 실패.
  FORECAST_GAP_MAX_HOURS: z.coerce.number().int().positive().default(3),

  // 전문가 모드 입력 범위(docs/01-functional-spec.md 4.3, docs/05-open-questions.md #11 —
  // 목업 단계 값, 실제 연동 때 재확정). 대시보드 입력 필드와 같은 범위로 중계 서버도 재검증한다.
  EXPERT_TEMP_MIN: z.coerce.number().default(-30),
  EXPERT_TEMP_MAX: z.coerce.number().default(50),
  EXPERT_RH_MIN: z.coerce.number().default(0),
  EXPERT_RH_MAX: z.coerce.number().default(100),
  EXPERT_VENT_MIN: z.coerce.number().default(20),
  EXPERT_VENT_MAX: z.coerce.number().default(100),
});

const refinedEnvSchema = envSchema.superRefine((e, ctx) => {
  const temps = e.FAN_STEP_TEMPS;
  if (temps.some((t, i) => i > 0 && t <= (temps[i - 1] ?? -Infinity))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['FAN_STEP_TEMPS'], message: '오름차순이어야 합니다' });
  }
  if (e.FAN_STEP_PCTS.length !== temps.length + 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['FAN_STEP_PCTS'], message: `FAN_STEP_TEMPS보다 1개 많아야 합니다(${temps.length + 1}개)` });
  }
});

export type Env = z.infer<typeof refinedEnvSchema>;

/**
 * 설정이 잘못됐을 때 **비개발자가 읽고 조치할 수 있는 메시지**를 찍는다(M7-3).
 *
 * 2026-10-23 온도 측 테스트에는 개발자가 자리에 없다. 전에는 zod 이슈 목록만 영어 경로로
 * 찍혀서(`FARM_LAT: Expected number, received nan`) 받는 쪽에서 뭘 해야 할지 알 수 없었다.
 * `.env` 자체가 없는 경우를 따로 구분하는 이유도 같다 — 다른 PC에 복사하면 `.env`는
 * `.gitignore` 대상이라 따라오지 않아서, 가장 흔한 실패가 이것이다.
 */
function printConfigHelp(issues: string): void {
  const bar = '='.repeat(64);
  console.error('');
  console.error(bar);
  console.error(' 설정에 문제가 있어 중계 서버를 시작할 수 없습니다.');
  console.error(bar);
  console.error('');

  if (!existsSync(envFilePath)) {
    console.error(' 설정 파일(.env)이 없습니다.');
    console.error(` 찾은 위치: ${envFilePath}`);
    console.error('');
    console.error(' [조치] setup.bat 을 실행해 설정을 만드세요.');
    console.error('        전달받은 .env 파일이 따로 있다면 위 위치에 복사하세요.');
  } else {
    console.error(' 아래 설정값이 비어 있거나 형식이 맞지 않습니다:');
    console.error('');
    console.error(issues);
    console.error('');
    console.error(' [조치] setup.bat 을 실행해 값을 채우세요.');
    console.error('        setup.bat 으로 고칠 수 없는 항목이면 담당자에게 이 화면을 전달하세요.');
  }

  console.error('');
  console.error(bar);
  console.error('');
}

function loadEnv(): Env {
  const result = refinedEnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    printConfigHelp(issues);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
