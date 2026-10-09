// GET /api/detail/geometry가 그대로 반환할 형상 파일 로더. env.ts와 같은 패턴:
// 파일이 없거나 Geometry 형태와 맞지 않으면 서버 시작 자체를 실패시키고 명확한 에러를
// 남긴다(docs/04-tasks.md M3). 검증 로직 자체는 transforms/geometryValidate.ts(순수 함수,
// 단위 테스트 있음)를 그대로 쓴다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Geometry } from '@ondo/shared';
import { validateGeometry } from '../transforms/geometryValidate.js';
import { env } from './env.js';

// 컴파일 결과 apps/relay/dist/config/geometry.js 기준 저장소 루트 — env.ts의
// ".env" 경로 계산과 동일한 깊이(config → dist → relay → apps → root).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');

function loadGeometry(): Geometry {
  const filePath = path.resolve(REPO_ROOT, env.GEOMETRY_FILE);

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(
      `[config] GEOMETRY_FILE을 읽을 수 없습니다: ${filePath}\n  - ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error(
      `[config] GEOMETRY_FILE JSON 파싱에 실패했습니다: ${filePath}\n  - ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  const result = validateGeometry(json);
  if (!result.ok) {
    console.error(`[config] GEOMETRY_FILE이 Geometry 형태와 맞지 않습니다: ${filePath}\n${result.message}`);
    process.exit(1);
  }

  return result.data;
}

export const geometry: Geometry = loadGeometry();
