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
  FORECAST_INPUT_FORMAT: z.enum(['series', 'summary']).default('series'),
  FAN_T_100: z.coerce.number().default(30),
  FAN_T_50: z.coerce.number().default(27),
  FAN_T_20: z.coerce.number().default(24),

  SECTION_Z_M: z.coerce.number().default(0.5),

  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  COMPUTE_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),

  GEOMETRY_FILE: z.string().min(1).default('./config/geometry.json'),
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
