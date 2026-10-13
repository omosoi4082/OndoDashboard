// 목업 파일 로더(mock/README.md, docs/03-upstream-apis.md 4.4) — 네 모드 전부를 다룬다:
// 전문가·제어는 mock_expert.json·mock_control.json, 현재·예측은 온도 측이 준
// sample_response_current.json·sample_response_forecast.json(2026-10-13 C: "연산 서버가
// 열리기 전까지는 응답 파일을 연산 서버 대신 읽어 두 화면을 구현해 주시면 감사하겠습니다").
//
// GEOMETRY_FILE과 달리 서버 시작을 막지 않는다 — 파일이 없거나 형식이 안 맞아도 서버는
// 뜨고, 해당 라우트만 오류를 반환한다(현재·예측은 합성 생성기로 폴백한다 —
// clients/mockComputeClient.ts). 첫 요청에서 성공적으로 읽으면 캐시(파일이 수 MB라 매
// 요청마다 다시 읽지 않는다). 파일을 나중에 추가/교체해도 재시작 없이 다음 요청에서 다시
// 읽도록, 실패 시에는 캐시하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseComputeResponse, type ComputeOkResult } from '../clients/computeClient.js';
import { parseControlMockFile, parseExpertMockFile, type ParsedControlFile, type ParsedExpertFile } from '../transforms/mockFileParse.js';
import { env } from './env.js';

// 컴파일 결과 apps/relay/dist/config/mockDetailFiles.js 기준 저장소 루트(geometry.ts와 같은 깊이).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');

export type MockFileResult<T> = { ok: true; data: T } | { ok: false; message: string };

let cachedExpert: ParsedExpertFile | null = null;
let cachedControl: ParsedControlFile | null = null;
let cachedResponseCurrent: ComputeOkResult | null = null;
let cachedResponseForecast: ComputeOkResult | null = null;

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

/**
 * 현재·예측 모드 응답 파일 로더. 이 두 파일은 **연산 서버 응답 그대로**(`status`·
 * `request_id`·`model_version`·`frames`·`range`·`geometryId`)라서 HTTP 응답과 똑같이
 * parseComputeResponse로 검증한다 — mock_expert/control처럼 별도 파서가 필요 없다.
 */
function loadResponseFile(relPath: string, label: string): MockFileResult<ComputeOkResult> {
  const file = readJsonFile(relPath);
  if (!file.ok) return file;
  const parsed = parseComputeResponse(file.json);
  if (!parsed.ok) return { ok: false, message: `${label} 형식이 올바르지 않습니다: ${parsed.message}` };
  return { ok: true, data: parsed };
}

export function loadMockResponseCurrentFile(): MockFileResult<ComputeOkResult> {
  if (cachedResponseCurrent) return { ok: true, data: cachedResponseCurrent };
  const result = loadResponseFile(env.MOCK_RESPONSE_CURRENT_FILE, 'sample_response_current.json');
  if (!result.ok) return result;
  cachedResponseCurrent = result.data;
  return result;
}

export function loadMockResponseForecastFile(): MockFileResult<ComputeOkResult> {
  if (cachedResponseForecast) return { ok: true, data: cachedResponseForecast };
  const result = loadResponseFile(env.MOCK_RESPONSE_FORECAST_FILE, 'sample_response_forecast.json');
  if (!result.ok) return result;
  cachedResponseForecast = result.data;
  return result;
}
