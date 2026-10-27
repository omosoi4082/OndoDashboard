/**
 * 설정 입력 스크립트 (`npm run setup`, `setup.bat`) — M7-3.
 *
 * 온도 측이 `.env`를 직접 열어 고치지 않게 하는 것이 목적이다. 특히 **연산 서버 주소는 전달
 * 이후에 받기로 되어 있어**(2026-10-17), 이 스크립트가 그 값을 넣는 유일한 경로가 된다.
 *
 * 다루는 값만 묻는다 — 나머지(격자, 임계값, 목업 경로 등)는 전달 패키지의 `.env`에 이미 맞게
 * 들어 있고, 비개발자가 건드릴 일이 없다. 묻는 값:
 *   1. 기상청 서비스키
 *   2. 연산 서버 모드(mock/http)와 주소
 *   3. 센서 서버 모드(live/mock)와 주소
 *
 * 규칙: 기존 값을 보여 주고 **엔터만 치면 그대로 둔다**. 저장 전 `.env.bak`으로 백업한다.
 * `.env`가 없으면 `.env.example`을 바탕으로 새로 만든다.
 */
import path from 'node:path';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { getEnvValue, maskSecret, normalizeBaseUrl, setEnvValue } from '../utils/envFile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../../');
const envPath = path.join(repoRoot, '.env');
const examplePath = path.join(repoRoot, '.env.example');
const backupPath = path.join(repoRoot, '.env.bak');

async function main(): Promise<void> {
  console.log('='.repeat(64));
  console.log(' 온도 돈사 대시보드 — 설정');
  console.log('='.repeat(64));
  console.log('');

  if (!existsSync(envPath)) {
    if (!existsSync(examplePath)) {
      console.log('❌ .env 와 .env.example 이 둘 다 없습니다.');
      console.log('   전달받은 폴더의 압축이 제대로 풀렸는지 확인하세요.');
      process.exit(1);
    }
    copyFileSync(examplePath, envPath);
    console.log('ℹ️  .env 가 없어서 .env.example 을 복사해 새로 만들었습니다.');
    console.log('');
  }

  let text = readFileSync(envPath, 'utf8');
  const rl = createInterface({ input: stdin, output: stdout });

  console.log('값을 바꾸지 않으려면 그냥 엔터를 치세요. (현재 값이 그대로 유지됩니다)');
  console.log('');

  // ── 1. 기상청 서비스키 ──────────────────────────────────────────────
  console.log('[1/3] 기상청 서비스키');
  console.log('      공공데이터포털 "단기예보 조회서비스"의 일반 인증키(Decoding)입니다.');
  console.log(`      현재 값: ${maskSecret(getEnvValue(text, 'KMA_SERVICE_KEY'))}`);
  const kmaKey = (await rl.question('      새 값 > ')).trim();
  if (kmaKey !== '') text = setEnvValue(text, 'KMA_SERVICE_KEY', kmaKey);
  console.log('');

  // ── 2. 연산 서버 ────────────────────────────────────────────────────
  console.log('[2/3] 연산 서버');
  console.log('      mock = 목업 파일로 화면만 확인 (연산 서버 주소를 모를 때)');
  console.log('      http = 실제 연산 서버 호출');
  console.log(`      현재 모드: ${getEnvValue(text, 'COMPUTE_MODE') || 'mock'}`);
  const computeMode = (await rl.question('      새 모드 (mock / http) > ')).trim().toLowerCase();
  if (computeMode === 'mock' || computeMode === 'http') {
    text = setEnvValue(text, 'COMPUTE_MODE', computeMode);
  } else if (computeMode !== '') {
    console.log('      ⚠️  mock 또는 http 만 쓸 수 있습니다 — 모드를 바꾸지 않았습니다.');
  }

  const effectiveMode = computeMode === 'mock' || computeMode === 'http' ? computeMode : getEnvValue(text, 'COMPUTE_MODE') || 'mock';
  if (effectiveMode === 'http') {
    console.log('');
    console.log('      연산 서버 주소를 넣으세요. 예: http://192.168.0.21:9000');
    console.log('      (같은 PC에서 돌린다면 http://localhost:9000)');
    console.log(`      현재 주소: ${getEnvValue(text, 'COMPUTE_BASE_URL') || '(비어 있음)'}`);
    const url = (await rl.question('      새 주소 > ')).trim();
    if (url !== '') {
      const normalized = normalizeBaseUrl(url);
      if (normalized === null) {
        console.log('      ⚠️  http:// 또는 https:// 로 시작해야 합니다 — 주소를 바꾸지 않았습니다.');
      } else {
        text = setEnvValue(text, 'COMPUTE_BASE_URL', normalized);
      }
    }

    // 가시화 데이터(v1.3.3 viz) — 연산 서버가 v1.3.3 이상일 때만 켠다(2026-10-27).
    console.log('');
    console.log('      가시화 데이터(유동 입자용 정밀 유속·급기 조건)를 받을지 정하세요.');
    console.log('      on  = 받음 (연산 서버 버전이 v1.3.3 이상일 때만)');
    console.log('      off = 받지 않음 (기본, 유동 입자는 기존 288점으로 그림)');
    console.log(`      현재: ${getEnvValue(text, 'COMPUTE_VIZ') === 'true' ? 'on' : 'off'}`);
    const viz = (await rl.question('      새 값 (on / off) > ')).trim().toLowerCase();
    if (viz === 'on' || viz === 'off') {
      text = setEnvValue(text, 'COMPUTE_VIZ', viz === 'on' ? 'true' : 'false');
    } else if (viz !== '') {
      console.log('      ⚠️  on 또는 off 만 쓸 수 있습니다 — 바꾸지 않았습니다.');
    }
  }
  console.log('');

  // ── 3. 센서 서버 ────────────────────────────────────────────────────
  console.log('[3/3] 센서 서버');
  console.log('      live = 실제 센서 서버 호출 (기본)');
  console.log('      mock = 센서에 접근할 수 없을 때 픽스처로 화면만 확인');
  console.log(`      현재 모드: ${getEnvValue(text, 'SENSOR_MODE') || 'live'}`);
  const sensorMode = (await rl.question('      새 모드 (live / mock) > ')).trim().toLowerCase();
  if (sensorMode === 'live' || sensorMode === 'mock') {
    text = setEnvValue(text, 'SENSOR_MODE', sensorMode);
  } else if (sensorMode !== '') {
    console.log('      ⚠️  live 또는 mock 만 쓸 수 있습니다 — 모드를 바꾸지 않았습니다.');
  }

  const effectiveSensor = sensorMode === 'live' || sensorMode === 'mock' ? sensorMode : getEnvValue(text, 'SENSOR_MODE') || 'live';
  if (effectiveSensor === 'live') {
    console.log(`      현재 주소: ${getEnvValue(text, 'SENSOR_BASE_URL') || '(비어 있음)'}`);
    const url = (await rl.question('      새 주소 (엔터 = 그대로) > ')).trim();
    if (url !== '') {
      const normalized = normalizeBaseUrl(url);
      if (normalized === null) {
        console.log('      ⚠️  http:// 또는 https:// 로 시작해야 합니다 — 주소를 바꾸지 않았습니다.');
      } else {
        text = setEnvValue(text, 'SENSOR_BASE_URL', normalized);
      }
    }
  }

  rl.close();

  copyFileSync(envPath, backupPath);
  writeFileSync(envPath, text, 'utf8');

  console.log('');
  console.log('='.repeat(64));
  console.log(' ✅ 저장했습니다. (이전 설정은 .env.bak 에 백업했습니다)');
  console.log('');
  console.log(' 다음 순서로 진행하세요:');
  console.log('   1) start.bat  — 서버를 띄우고 브라우저를 엽니다');
  console.log('   2) check.bat  — 센서·기상청·연산 서버 연결을 점검합니다');
  console.log('='.repeat(64));
}

await main();
