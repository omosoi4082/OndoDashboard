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
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),

  SENSOR_MODE: z.enum(['live', 'mock']).default('live'),
  SENSOR_BASE_URL: z.string().min(1),
  INPUT_T_OUT_PATH: z.string().min(1).default('JE/OU/WS/WS1/TEMP'),
  INPUT_RH_OUT_PATH: z.string().min(1).default('JE/OU/WS/WS1/RH'),
  INPUT_FAN_PATH: z.string().min(1).default('JE/EX/NH/FN1/FAN1'),

  KMA_SERVICE_KEY: z.string().default(''),
  FARM_LAT: z.coerce.number(),
  FARM_LON: z.coerce.number(),
  KMA_NX: z.coerce.number().int(),
  KMA_NY: z.coerce.number().int(),

  COMPUTE_MODE: z.enum(['mock', 'http']).default('mock'),
  COMPUTE_BASE_URL: z.string().min(1).default('http://localhost:9000'),
  COMPUTE_API_KEY: z.string().default(''),
  COMPUTE_API_KEY_HEADER: z.string().min(1).default('X-API-Key'),
  // 예측 입력(forecast 구간) fan_pct 계산식(docs/03 2장): clamp(FAN_MIN + (FAN_MAX-FAN_MIN)
  // *(T_out-FAN_T_LOW)/(FAN_T_HIGH-FAN_T_LOW), FAN_MIN, FAN_MAX). summary 형식은 폐기됨
  // (FORECAST_INPUT_FORMAT·FAN_T_100·FAN_T_50·FAN_T_20 제거, 2026-10-07 확정).
  FAN_T_LOW: z.coerce.number().default(22),
  FAN_T_HIGH: z.coerce.number().default(30),
  FAN_MIN: z.coerce.number().default(20),
  FAN_MAX: z.coerce.number().default(100),

  SECTION_Z_M: z.coerce.number().default(0.5),

  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  COMPUTE_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),

  GEOMETRY_FILE: z.string().min(1).default('./config/geometry.json'),

  // 전문가·제어 모드 목업 파일(docs/03-upstream-apis.md 4.4, mock/README.md). 온도 측이
  // 제공한 실제 파일 경로(현재 mock/ 바로 아래, 서브폴더 없음). 파일이 없으면 해당 라우트만
  // 오류를 반환한다(서버 시작은 막지 않음 — GEOMETRY_FILE과 달리 필수 아님).
  MOCK_EXPERT_FILE: z.string().min(1).default('./mock/mock_expert.json'),
  MOCK_CONTROL_FILE: z.string().min(1).default('./mock/mock_control.json'),

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

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
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
