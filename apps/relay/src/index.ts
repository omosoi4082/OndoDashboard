import path from 'node:path';
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
});

// 센서 5분 집계·결측 처리 임계값(docs/03-upstream-apis.md 1.2) — 세 항목 모두 같은
// 보간/오류 임계값을 쓰지만 범위(온도·습도·팬)만 다르다.
const aggCommon = {
  interpMaxGap: env.AGG_INTERP_MAX_GAP,
  errorMinGap: env.AGG_ERROR_MIN_GAP,
  errorMaxRatio: env.AGG_ERROR_MAX_RATIO,
};
const aggThresholds: { temp: AggregateThresholds; rh: AggregateThresholds; fan: AggregateThresholds } = {
  temp: { ...aggCommon, rangeMin: env.SENSOR_TEMP_MIN, rangeMax: env.SENSOR_TEMP_MAX },
  rh: { ...aggCommon, rangeMin: env.SENSOR_RH_MIN, rangeMax: env.SENSOR_RH_MAX },
  fan: { ...aggCommon, rangeMin: env.SENSOR_FAN_MIN, rangeMax: env.SENSOR_FAN_MAX },
};

registerHealthRoute(app, { sensorClient, kmaClient });
registerMainRoomsRoute(app, { sensorClient });
registerMainWeatherKmaRoute(app, { kmaClient, farmLat: env.FARM_LAT, farmLon: env.FARM_LON });
registerMainWeatherStationRoute(app, { sensorClient, farmLat: env.FARM_LAT, farmLon: env.FARM_LON });
registerDetailGeometryRoute(app, { geometry });
registerDetailCurrentRoute(app, {
  sensorHistoryClient,
  computeClient,
  geometry,
  inputPaths: { tOut: env.INPUT_T_OUT_PATH, rhOut: env.INPUT_RH_OUT_PATH, fanPct: env.INPUT_FAN_PATH },
  thresholds: aggThresholds,
});
registerDetailForecastRoute(app, {
  sensorHistoryClient,
  kmaClient,
  computeClient,
  geometry,
  inputPaths: { tOut: env.INPUT_T_OUT_PATH, rhOut: env.INPUT_RH_OUT_PATH, fanPct: env.INPUT_FAN_PATH },
  thresholds: aggThresholds,
  forecastGapMaxHours: env.FORECAST_GAP_MAX_HOURS,
  fanPctConfig: { tLow: env.FAN_T_LOW, tHigh: env.FAN_T_HIGH, min: env.FAN_MIN, max: env.FAN_MAX },
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

// 운영 모드: apps/dashboard 빌드 결과를 정적 서빙, /api 외 경로는 index.html (M7에서 완성).
const dashboardDist = path.resolve(__dirname, '../../dashboard/dist');
if (env.PORT && process.env.NODE_ENV === 'production') {
  await app.register(fastifyStatic, { root: dashboardDist });
  app.setNotFoundHandler((req, reply) => {
    if (!req.url.startsWith('/api')) {
      reply.sendFile('index.html');
      return;
    }
    reply.code(404).send({ status: 'error', error: { code: 'BAD_REQUEST', source: 'relay', message: 'Not found' } });
  });
}

app.listen({ port: env.PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
