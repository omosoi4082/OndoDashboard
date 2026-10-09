// npm run mock:generate — 온도 측 실제 mock_expert.json·mock_control.json(mock/README.md)이
// 없을 때만 쓰는 폴백. 지금은 실제 파일이 mock/에 있으므로 보통 실행할 필요 없다
// (docs/03-upstream-apis.md 4.3·4.4). 그래도 실행하면 config/mockDetailFiles.ts가 그대로
// 읽을 수 있는 "연산 서버 원응답 + 목업 전용 필드" 형태(request_id·status·model_version·
// frames, control은 snake_case)로 결정적 합성 데이터를 만들어 MOCK_EXPERT_FILE·
// MOCK_CONTROL_FILE 경로에 쓴다. 실제 파일을 덮어쓰고 싶지 않다면 실행 전에 백업하거나
// .env의 경로를 바꿀 것.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { geometry } from '../config/geometry.js';
import { completedTenMinuteWindow } from '../transforms/currentWindow.js';
import { buildControlSeries, buildExpertSeries, type ControlGenOptions, type ExpertGenOptions } from '../transforms/mockExpertControlGen.js';
import { kstWallClock } from '../utils/time.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 컴파일 결과 apps/relay/dist/scripts/mockGenerate.js 기준 저장소 루트(geometry.ts와 같은 깊이).
const REPO_ROOT = path.resolve(__dirname, '../../../../');

// 생성 파라미터(목업 전용 상수 — 실제 운영 설정이 아니라 "그럴듯한" 합성 데이터 모양만
// 결정하므로 .env로 빼지 않는다. geometryValidate 등 필수 설정과는 성격이 다르다).
const DAY_CYCLE = { tOutBase: 24, tOutAmplitude: 6, rhOutBase: 68, rhOutAmplitude: 12 };
const FAN_BASELINE = { min: 20, max: 85 };
const DIP = { centerFrac: 0.5, widthFrac: 0.18, amplitude: 22 };
const CONTROL_OPTS: ControlGenOptions = {
  dayCycle: DAY_CYCLE,
  fanBaseline: FAN_BASELINE,
  dip: DIP,
  tMeanMaxConstraint: 29,
  fanRatedKw: 0.75,
};
const EXPERT_OPTS: ExpertGenOptions = { dayCycle: DAY_CYCLE, fan: FAN_BASELINE };

function writeJson(relPath: string, data: unknown): void {
  const filePath = path.resolve(REPO_ROOT, relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
  console.log(`[mock:generate] ${filePath} 생성 완료`);
}

function main(): void {
  const baseTime = completedTenMinuteWindow(kstWallClock(new Date())).endMin;

  const expertFrames = buildExpertSeries(geometry, baseTime, EXPERT_OPTS);
  writeJson(env.MOCK_EXPERT_FILE, {
    request_id: randomUUID(),
    status: 'ok',
    model_version: 'mock-v1',
    mock: true,
    mock_version: 'relay-fallback',
    note: '온도 측 실제 mock_expert.json이 없을 때 relay(npm run mock:generate)가 만든 폴백 — 형식 확인용 합성 데이터, 실제 모델 결과가 아님.',
    mode: 'expert',
    frames: expertFrames,
  });

  const { frames: controlFrames, control } = buildControlSeries(geometry, baseTime, CONTROL_OPTS);
  writeJson(env.MOCK_CONTROL_FILE, {
    request_id: randomUUID(),
    status: 'ok',
    model_version: 'mock-v1',
    mock: true,
    mock_version: 'relay-fallback',
    note: '온도 측 실제 mock_control.json이 없을 때 relay(npm run mock:generate)가 만든 폴백 — 형식 확인용 합성 데이터, 실제 모델 결과가 아님.',
    mode: 'control',
    target: 'energy',
    control: {
      baseline_fan_pct: control.baselineFanPct,
      optimized_fan_pct: control.optimizedFanPct,
      baseline_T_mean: control.baselineTMean,
      optimized_T_mean: control.optimizedTMean,
      energy_kwh: control.energyKwh,
      saving_pct: control.savingPct,
      T_max: control.tMax,
      constraint: { T_mean_max: control.constraint.tMeanMax },
    },
    frames: controlFrames,
  });

  console.log('[mock:generate] 완료 (실제 온도 측 파일이 mock/에 있으면 relay는 그 파일을 우선 사용합니다).');
}

main();
