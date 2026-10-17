import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyCompress from '@fastify/compress';
import fastifyStatic from '@fastify/static';
import { env } from './config/env.js';
import { registerHealthRoute } from './routes/health.js';
import { registerMainRoomsRoute } from './routes/mainRooms.js';
import { registerMainWeatherKmaRoute } from './routes/mainWeatherKma.js';
import { registerMainWeatherStationRoute } from './routes/mainWeatherStation.js';
import { registerDetailGeometryRoute } from './routes/detailGeometry.js';
import { registerDetailCurrentRoute } from './routes/detailCurrent.js';
import { registerDetailForecastRoute } from './routes/detailForecast.js';
import { registerDetailExpertRoute } from './routes/detailExpert.js';
import { registerDetailControlRoute } from './routes/detailControl.js';
import { createSensorClient } from './clients/sensorClient.js';
import { createSensorHistoryClient } from './clients/sensorHistoryClient.js';
import { createKmaClient } from './clients/kmaClient.js';
import { createComputeClient } from './clients/computeClientFactory.js';
import type { AggregateThresholds } from './transforms/aggregate5min.js';
import type { MeasuredInputsDeps } from './routes/measuredInputs.js';
import { geometry } from './config/geometry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({
  logger: {
    level: 'info',
    transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
  },
});

await app.register(fastifyCompress);

const sensorClient = createSensorClient({
  mode: env.SENSOR_MODE,
  baseUrl: env.SENSOR_BASE_URL,
  timeoutMs: env.UPSTREAM_TIMEOUT_MS,
});

const kmaClient = createKmaClient({
  serviceKey: env.KMA_SERVICE_KEY,
  nx: env.KMA_NX,
  ny: env.KMA_NY,
  timeoutMs: env.UPSTREAM_TIMEOUT_MS,
  vilageMaxStepsBack: env.KMA_VILAGE_MAX_STEPS_BACK,
});

const sensorHistoryClient = createSensorHistoryClient({
  mode: env.SENSOR_HISTORY_MODE ?? env.SENSOR_MODE,
  baseUrl: env.SENSOR_BASE_URL,
  timeoutMs: env.UPSTREAM_TIMEOUT_MS,
});

const computeClient = createComputeClient({
  mode: env.COMPUTE_MODE,
  geometry,
  baseUrl: env.COMPUTE_BASE_URL,
  apiKey: env.COMPUTE_API_KEY,
  apiKeyHeader: env.COMPUTE_API_KEY_HEADER,
  timeoutMs: env.COMPUTE_TIMEOUT_MS,
  pingTimeoutMs: env.UPSTREAM_TIMEOUT_MS,
  retryDelayMs: env.COMPUTE_RETRY_DELAY_MS,
});

// 센서 5분 집계·결측 처리 임계값(docs/03-upstream-apis.md 1.2) — 센서 이력을 쓰는 연산 입력은
// 환기팬 가동률 하나뿐이다(2026-10-13 B-3). 범위 밖 처리(2026-10-13 온도 측 A-2·B-5): 센서
// 특성상 172.5처럼 튀는 값이 섞여 들어오므로 결측으로 보지 않고 경계값으로 자른다('clamp').
const fanAggThreshold: AggregateThresholds = {
  interpMaxGap: env.AGG_INTERP_MAX_GAP,
  errorMinGap: env.AGG_ERROR_MIN_GAP,
  errorMaxRatio: env.AGG_ERROR_MAX_RATIO,
  rangeMin: env.SENSOR_FAN_MIN,
  rangeMax: env.SENSOR_FAN_MAX,
  outOfRange: 'clamp',
};

registerHealthRoute(app, { sensorClient, kmaClient, computeClient });
registerMainRoomsRoute(app, {
  sensorClient,
  // 화면 표시용 환기팬 범위도 .env를 따른다(연산 입력 클램프와 같은 값, A-2).
  fanRange: { min: env.SENSOR_FAN_MIN, max: env.SENSOR_FAN_MAX },
});
registerMainWeatherKmaRoute(app, { kmaClient, farmLat: env.FARM_LAT, farmLon: env.FARM_LON, areaName: env.FARM_AREA_NAME });
registerMainWeatherStationRoute(app, { sensorClient, farmLat: env.FARM_LAT, farmLon: env.FARM_LON });
registerDetailGeometryRoute(app, { geometry });
// 현재·예측 모드 실측 구간 입력(routes/measuredInputs.ts). 센서 이력은 환기팬 하나만 쓰고,
// 외기 온·습도는 기상청 실황 정시 값이다(2026-10-13 B-3) — 그 값의 유효 범위는 센서와 같은
// 온도·습도 범위를 쓴다.
const measuredDeps: MeasuredInputsDeps = {
  sensorHistoryClient,
  kmaClient,
  fanPath: env.INPUT_FAN_PATH,
  fanThreshold: fanAggThreshold,
  outdoorRange: { tempMin: env.SENSOR_TEMP_MIN, tempMax: env.SENSOR_TEMP_MAX, rhMin: env.SENSOR_RH_MIN, rhMax: env.SENSOR_RH_MAX },
};
registerDetailCurrentRoute(app, { measured: measuredDeps, computeClient, geometry });
registerDetailForecastRoute(app, {
  measured: measuredDeps,
  kmaClient,
  computeClient,
  geometry,
  forecastGapMaxHours: env.FORECAST_GAP_MAX_HOURS,
  fanPctConfig: { stepTemps: env.FAN_STEP_TEMPS, stepPcts: env.FAN_STEP_PCTS },
});
registerDetailExpertRoute(app, {
  geometry,
  inputRange: {
    tempMin: env.EXPERT_TEMP_MIN,
    tempMax: env.EXPERT_TEMP_MAX,
    rhMin: env.EXPERT_RH_MIN,
    rhMax: env.EXPERT_RH_MAX,
    ventMin: env.EXPERT_VENT_MIN,
    ventMax: env.EXPERT_VENT_MAX,
  },
});
registerDetailControlRoute(app, { geometry });

// 운영 모드: apps/dashboard 빌드 결과를 정적 서빙, /api 외 경로는 index.html.
// 조건은 "빌드 결과가 있으면"이다 — 전에는 NODE_ENV === 'production'이었는데, `npm start`
// (`node dist/index.js`)가 NODE_ENV를 세우지 않아 8080에 API만 뜨고 화면이 안 나왔다(M7-1).
// 환경변수 하나를 빼먹어 화면이 안 뜨는 함정을 없애려고 파일 존재로 판정한다. 개발 모드
// (`npm run dev`)는 대시보드를 5173에서 띄우고 /api만 프록시하므로, dist가 남아 있어 8080에서도
// 같이 서빙되더라도 개발에 영향이 없다.
const dashboardDist = path.resolve(__dirname, '../../dashboard/dist');
const dashboardIndex = path.join(dashboardDist, 'index.html');
const servesDashboard = existsSync(dashboardIndex);

if (servesDashboard) {
  await app.register(fastifyStatic, { root: dashboardDist });
  app.setNotFoundHandler((req, reply) => {
    if (!req.url.startsWith('/api')) {
      reply.sendFile('index.html');
      return;
    }
    reply.code(404).send({ status: 'error', error: { code: 'BAD_REQUEST', source: 'relay', message: 'Not found' } });
  });
}

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// 구동 직후 지금 설정을 한 덩어리로 찍는다(M7-2). 온도 측이 로그만 보고 접속 주소와
// mock/live 여부를 알 수 있어야 한다 — 사용자 없이 테스트하므로 추측할 여지를 남기지 않는다.
app.log.info('─'.repeat(60));
app.log.info(
  servesDashboard
    ? `대시보드 주소: http://localhost:${env.PORT}  (브라우저에서 열어 주세요)`
    : `중계 서버만 떴습니다: http://localhost:${env.PORT}/api/health  (대시보드 빌드 결과가 없습니다 — 개발 모드면 http://localhost:5173)`,
);
app.log.info(`센서 서버 : ${env.SENSOR_MODE}${env.SENSOR_MODE === 'live' ? ` (${env.SENSOR_BASE_URL})` : ' (픽스처)'}`);
app.log.info(`기상청    : 격자 nx ${env.KMA_NX} / ny ${env.KMA_NY}${env.KMA_SERVICE_KEY ? '' : '  ⚠ 서비스키가 비어 있어 기상청 조회가 실패합니다'}`);
app.log.info(
  env.COMPUTE_MODE === 'http'
    ? `연산 서버 : http (${env.COMPUTE_BASE_URL})`
    : '연산 서버 : mock (목업 파일 — 실제 연산 결과가 아닙니다)',
);
app.log.info('상태 점검 : check.bat  (또는 npm run doctor)');
app.log.info('─'.repeat(60));
