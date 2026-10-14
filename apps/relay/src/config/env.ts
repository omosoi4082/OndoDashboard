import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// 패키지 매니저가 apps/relay를 cwd로 실행하므로, 저장소 루트의 .env를 명시적으로 가리킨다.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

// .env.example과 항상 일치시킨다. 새 설정을 추가하면 두 파일을 같이 고친다.
// FARM_LAT/LON, KMA_NX/NY는 M1(KmaClient)부터 required로 좁힌다(docs/05-open-questions.md #12).
// KMA_SERVICE_KEY는 공공데이터포털에서 발급 전까지 빈 값일 수 있으므로 계속 optional(빈 문자열 허용) —
// 비어 있어도 서버는 뜨고, 실제 기상청 호출만 실패(disconnected)한다.
// 쉼표로 구분한 숫자 목록("22,24,26,28") → number[].
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
  FARM_LAT: z.coerce.number(),
  FARM_LON: z.coerce.number(),
  KMA_NX: z.coerce.number().int(),
  KMA_NY: z.coerce.number().int(),
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
  // 간격 — 2면 23:00 → 20:00 → 17:00). 2026-10-13 23:30 실측에서 두 단계 연속 NO_DATA였다.
  KMA_VILAGE_MAX_STEPS_BACK: z.coerce.number().int().nonnegative().default(2),

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

function loadEnv(): Env {
  const result = refinedEnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`[config] .env 설정이 올바르지 않습니다:\n${issues}`);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
