// docs/02-relay-api.md 4.1 GET /api/main/rooms
import type { FastifyInstance } from 'fastify';
import type { ApiOk, RoomId, RoomSummary, RoomsResponse } from '@ondo/shared';
import type { SensorClient } from '../clients/sensorClient.js';
import { buildRoomSummary } from '../transforms/roomBuilder.js';
import { nowKstIso } from '../utils/time.js';

interface RoomDef {
  id: RoomId;
  name: RoomSummary['name'];
  path: string; // 예: "JE/EX/NH"
}

const ROOM_DEFS: RoomDef[] = [
  { id: 'NH', name: '자돈방', path: 'JE/EX/NH' },
  { id: 'GH', name: '육성돈방', path: 'JE/EX/GH' },
  { id: 'FH', name: '비육돈방', path: 'JE/EX/FH' },
];

export function registerMainRoomsRoute(app: FastifyInstance, deps: { sensorClient: SensorClient }): void {
  app.get('/api/main/rooms', async (): Promise<ApiOk<RoomsResponse>> => {
    const requestedAt = nowKstIso();

    // NH/GH/FH × EN1/FN1 6개 경로 병렬 호출(docs/04-tasks.md M1).
    const results = await Promise.allSettled(
      ROOM_DEFS.flatMap((room) => [
        deps.sensorClient.latest(`${room.path}/EN1`),
        deps.sensorClient.latest(`${room.path}/FN1`),
      ]),
    );

    const data = {} as RoomsResponse;
    let anyDisconnected = false;

    ROOM_DEFS.forEach((room, i) => {
      const en1Result = results[i * 2];
      const fn1Result = results[i * 2 + 1];
      const en1 = en1Result?.status === 'fulfilled' ? en1Result.value : null;
      const fn1 = fn1Result?.status === 'fulfilled' ? fn1Result.value : null;

      const summary = buildRoomSummary(room.name, en1, fn1);
      if (summary.sourceStatus === 'disconnected') anyDisconnected = true;
      data[room.id] = summary;
    });

    return {
      status: anyDisconnected ? 'partial' : 'ok',
      requestedAt,
      data,
    };
  });
}
