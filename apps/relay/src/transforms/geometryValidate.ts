// GET /api/detail/geometry — GEOMETRY_FILE(기본 ./config/geometry.json)이 shared의
// Geometry 형태와 맞는지 검증하는 순수 로직(파일 I/O·process.exit는 config/geometry.ts에서
// 처리). 순수 함수로 분리해 단위 테스트한다(geometryValidate.test.ts).
import { z } from 'zod';
import type { Geometry } from '@ondo/shared';

const gridDefSchema = z.object({
  origin: z.tuple([z.number(), z.number(), z.number()]),
  spacing: z.tuple([z.number(), z.number(), z.number()]),
  size: z.tuple([z.number(), z.number(), z.number()]),
});

// 125개 포인트 좌표(05-open-questions.md #3): id·x·y·z. 그 외 필드(room 칸막이·급기구
// 등 상세 치수)는 relay 응답에 포함되지 않더라도(=geometry.json에 있어도) Geometry 타입에
// 없는 값이라 zod object()가 그대로 걸러낸다(strict 미적용, 여분 필드 무시).
const geometrySchema = z.object({
  geometryId: z.string().min(1),
  room: z.object({ size: z.tuple([z.number(), z.number(), z.number()]) }),
  points: z
    .array(z.object({ id: z.number(), x: z.number(), y: z.number(), z: z.number() }))
    .min(1),
  grid: gridDefSchema,
  flowGrid: gridDefSchema,
});

export type GeometryValidationResult =
  | { ok: true; data: Geometry }
  | { ok: false; message: string };

export function validateGeometry(json: unknown): GeometryValidationResult {
  const result = geometrySchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    return { ok: false, message: issues };
  }
  return { ok: true, data: result.data };
}
