import { describe, expect, it } from 'vitest';
import { getEnvValue, maskSecret, normalizeBaseUrl, parseEnvFile, setEnvValue } from './envFile.js';

const SAMPLE = `# 중계 서버 포트
PORT=8080

# 기상청 서비스키 (비어 있을 수 있다)
KMA_SERVICE_KEY=
COMPUTE_MODE=mock
# COMPUTE_BASE_URL 주석 설명
COMPUTE_BASE_URL=http://localhost:9000
`;

describe('getEnvValue', () => {
  it('값을 읽는다', () => {
    expect(getEnvValue(SAMPLE, 'PORT')).toBe('8080');
    expect(getEnvValue(SAMPLE, 'COMPUTE_BASE_URL')).toBe('http://localhost:9000');
  });

  it('비어 있는 값과 없는 키는 모두 빈 문자열', () => {
    expect(getEnvValue(SAMPLE, 'KMA_SERVICE_KEY')).toBe('');
    expect(getEnvValue(SAMPLE, 'NOPE')).toBe('');
  });

  it('주석 줄은 값으로 보지 않는다', () => {
    expect(getEnvValue('# PORT=9999\nPORT=8080', 'PORT')).toBe('8080');
  });
});

describe('setEnvValue', () => {
  it('값만 바꾸고 주석과 줄 순서를 보존한다', () => {
    const next = setEnvValue(SAMPLE, 'COMPUTE_MODE', 'http');
    expect(getEnvValue(next, 'COMPUTE_MODE')).toBe('http');
    expect(next).toContain('# 중계 서버 포트');
    expect(next).toContain('# COMPUTE_BASE_URL 주석 설명');
    expect(next.split('\n').length).toBe(SAMPLE.split('\n').length);
  });

  it('비어 있던 값도 채운다', () => {
    expect(getEnvValue(setEnvValue(SAMPLE, 'KMA_SERVICE_KEY', 'abc123'), 'KMA_SERVICE_KEY')).toBe('abc123');
  });

  it('없는 키는 맨 뒤에 덧붙인다', () => {
    const next = setEnvValue(SAMPLE, 'NEW_KEY', 'v');
    expect(getEnvValue(next, 'NEW_KEY')).toBe('v');
  });

  it('주석 처리된 같은 이름의 줄은 건드리지 않는다', () => {
    const text = '# PORT=9999\nPORT=8080';
    expect(setEnvValue(text, 'PORT', '7000')).toBe('# PORT=9999\nPORT=7000');
  });
});

describe('parseEnvFile', () => {
  it('주석·빈 줄을 빼고 Map으로 만든다', () => {
    const map = parseEnvFile(SAMPLE);
    expect(map.get('PORT')).toBe('8080');
    expect(map.get('KMA_SERVICE_KEY')).toBe('');
    expect(map.has('# 중계 서버 포트')).toBe(false);
  });
});

describe('maskSecret', () => {
  it('빈 값과 짧은 값은 그대로, 긴 값은 앞뒤만', () => {
    expect(maskSecret('')).toBe('(비어 있음)');
    expect(maskSecret('short')).toBe('short');
    expect(maskSecret('abcdefghijklmnopqrstuvwxyz')).toBe('abcdef…wxyz (26자)');
  });
});

describe('normalizeBaseUrl', () => {
  it('http(s) 주소는 끝 슬래시를 떼고 돌려준다', () => {
    expect(normalizeBaseUrl('http://192.168.0.21:9000/')).toBe('http://192.168.0.21:9000');
    expect(normalizeBaseUrl('  https://a.b/c  ')).toBe('https://a.b/c');
  });

  it('프로토콜이 없거나 빈 값이면 null', () => {
    expect(normalizeBaseUrl('192.168.0.21:9000')).toBeNull();
    expect(normalizeBaseUrl('')).toBeNull();
    expect(normalizeBaseUrl('http://')).toBeNull();
  });
});
