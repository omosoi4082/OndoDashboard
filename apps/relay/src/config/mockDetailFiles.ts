// 전문가·제어 모드 목업 파일 로더(mock/README.md, docs/03-upstream-apis.md 4.4). GEOMETRY_FILE
// 과 달리 서버 시작을 막지 않는다 — 파일이 없거나 형식이 안 맞아도 서버는 뜨고, 해당 라우트
// (/api/detail/expert, /api/detail/control)만 오류를 반환한다. 첫 요청에서 성공적으로
// 읽으면 캐시(파일이 수 MB라 매 요청마다 다시 읽지 않는다). 파일을 나중에 추가/교체해도
// 재시작 없이 다음 요청에서 다시 읽도록, 실패 시에는 캐시하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseControlMockFile, parseExpertMockFile, type ParsedControlFile, type ParsedExpertFile } from '../transforms/mockFileParse.js';
import { env } from './env.js';

// 컴파일 결과 apps/relay/dist/config/mockDetailFiles.js 기준 저장소 루트(geometry.ts와 같은 깊이).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');

export type MockFileResult<T> = { ok: true; data: T } | { ok: false; message: string };

let cachedExpert: ParsedExpertFile | null = null;
let cachedControl: ParsedControlFile | null = null;

function readJsonFile(relPath: string): { ok: true; json: unknown } | { ok: false; message: string } {
  const filePath = path.resolve(REPO_ROOT, relPath);
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    return {
      ok: false,
      message: `파일이 없습니다: ${filePath} (온도 측 목업 파일을 mock/에 넣거나 npm run mock:generate로 폴백을 생성하세요) — ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  try {
    return { ok: true, json: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, message: `JSON 파싱에 실패했습니다: ${filePath} — ${err instanceof Error ? err.message : String(err)}` };
  }
}

export function loadMockExpertFile(): MockFileResult<ParsedExpertFile> {
  if (cachedExpert) return { ok: true, data: cachedExpert };
  const file = readJsonFile(env.MOCK_EXPERT_FILE);
  if (!file.ok) return file;
  const parsed = parseExpertMockFile(file.json);
  if (!parsed.ok) return parsed;
  cachedExpert = parsed.data;
  return { ok: true, data: cachedExpert };
}

export function loadMockControlFile(): MockFileResult<ParsedControlFile> {
  if (cachedControl) return { ok: true, data: cachedControl };
  const file = readJsonFile(env.MOCK_CONTROL_FILE);
  if (!file.ok) return file;
  const parsed = parseControlMockFile(file.json);
  if (!parsed.ok) return parsed;
  cachedControl = parsed.data;
  return { ok: true, data: cachedControl };
}
