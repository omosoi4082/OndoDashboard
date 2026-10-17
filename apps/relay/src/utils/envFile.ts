/**
 * `.env` 파일 한 줄 단위 읽기·쓰기 순수 함수 — setup.ts(설정 스크립트)와 doctor.ts(점검
 * 스크립트)가 같이 쓴다.
 *
 * 파싱 후 재조립이 아니라 **줄 단위 치환**인 이유: `.env`에는 각 설정이 무슨 뜻인지 적은 주석이
 * 줄줄이 달려 있고(온도 측이 나중에 파일을 열어 볼 수 있어야 한다), 재조립하면 그게 다 날아간다.
 */

/** `.env` 본문에서 한 값을 읽는다. 없거나 주석 처리됐으면 ''. */
export function getEnvValue(text: string, key: string): string {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    if (line.slice(0, eq).trim() === key) return line.slice(eq + 1).trim();
  }
  return '';
}

/**
 * 한 값만 바꾼 `.env` 본문을 돌려준다. 주석·줄 순서·줄바꿈 종류는 그대로 둔다.
 * 그 키가 없으면 맨 뒤에 한 줄 덧붙인다. 주석 처리된 줄(`# KEY=`)은 건드리지 않는다.
 */
export function setEnvValue(text: string, key: string, value: string): string {
  const lines = text.split(/\r?\n/);
  let found = false;
  const next = lines.map((line) => {
    if (line.trim().startsWith('#')) return line;
    const eq = line.indexOf('=');
    if (eq <= 0) return line;
    if (line.slice(0, eq).trim() !== key) return line;
    found = true;
    return `${key}=${value}`;
  });
  if (!found) next.push(`${key}=${value}`);
  return next.join('\n');
}

/** `.env` 전체를 Map으로. doctor.ts의 필수값 검사용. */
export function parseEnvFile(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    map.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  }
  return map;
}

/** 키처럼 긴 값은 앞뒤만 보여 준다 — 창을 캡처해 공유해도 키가 그대로 노출되지 않게. */
export function maskSecret(value: string): string {
  if (value === '') return '(비어 있음)';
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)} (${value.length}자)`;
}

/** 주소 입력 검증 — http(s)로 시작해야 하고, 끝의 슬래시는 떼어 돌려준다. */
export function normalizeBaseUrl(raw: string): string | null {
  const url = raw.trim();
  if (!/^https?:\/\/\S+$/.test(url)) return null;
  return url.replace(/\/+$/, '');
}
