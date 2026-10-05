import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyCompress from '@fastify/compress';
import fastifyStatic from '@fastify/static';
import { env } from './config/env.js';
import { registerHealthRoute } from './routes/health.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({
  logger: {
    level: 'info',
    transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
  },
});

await app.register(fastifyCompress);

registerHealthRoute(app);

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
