// docs/03-upstream-apis.md 4.3 Mock. COMPUTE_MODE=mock일 때 쓰는 ComputeClient 구현.
// 연산 서버가 열리기 전까지만 쓰이는 경로다 — COMPUTE_MODE=http로 바꾸면 이 파일은 전혀
// 관여하지 않으므로(clients/computeClientFactory.ts), 여기의 어떤 보정도 실제 연동 동작에
// 영향을 주지 않는다.
//
// 1순위: **온도 측이 준 응답 파일을 읽어 돌려준다**(mock/sample_response_current.json,
// sample_response_forecast.json — 2026-10-13 C 요청 "연산 서버가 열리기 전까지는 응답 파일을
// 연산 서버 대신 읽어 두 화면을 구현해 주시면 감사하겠습니다"). 그래야 v3의 range·geometryId와
// 실제 모델 결과 형태가 화면에 그대로 반영된다.
//   단, 파일의 프레임 시각은 2026-10-05로 고정돼 있어 그대로 쓰면 현재 모드가 열흘 전 날짜를
//   보여준다. 그래서 **시각만 요청 기준으로 다시 깔고 값은 파일 그대로** 쓴다
//   (transforms/mockRebaseTime.ts, 사용자 결정 — "시간만 바꿔서 값은 그대로 사용").
//
// 2순위(폴백): 파일이 없거나 형식이 안 맞으면 transforms/mockComputeGen.ts로 프레임을
// 합성한다 — 원래 "온도 측 데이터가 없을 때 화면이 뜨는지 보려고" 만든 경로다.
// current는 입력 중 마지막 시각의 프레임 1개(docs/03 4.2), forecast는 마지막 실측 시각
// (37번째 입력, index 36)부터 10분 간격 145개(docs/02 5장)를 입력 시각에 맞춰 생성한다.
import type { Geometry } from '@ondo/shared';
import type { ComputeClient, ComputeFrame, ComputeOkResult, ComputeRequestInput, ComputeResult } from './computeClient.js';
import {
  loadMockResponseCurrentFile,
  loadMockResponseForecastFile,
  type MockFileResult,
} from '../config/mockDetailFiles.js';
import { generateMockFrame } from '../transforms/mockComputeGen.js';
import { rebaseFrameTimes } from '../transforms/mockRebaseTime.js';

const MOCK_MODEL_VERSION = 'mock-v1';
const CURRENT_INPUT_COUNT = 37; // docs/02-relay-api.md 6장
const FORECAST_FRAME_COUNT = 145; // docs/02-relay-api.md 5장(0~1,440분, 10분 간격)
const FORECAST_FRAME_STEP_INPUTS = 2; // 10분 간격 / 5분 입력 간격
const FORECAST_INTERVAL_MIN = 10;

/** 응답 파일 로더 — 테스트에서 "파일 없음"(폴백)과 "파일 있음"을 모두 만들 수 있게 주입한다. */
export type ResponseFileLoader = () => MockFileResult<ComputeOkResult>;

export interface MockComputeClientOpts {
  geometry: Geometry;
  /** 기본값: mock/sample_response_current.json */
  loadCurrentFile?: ResponseFileLoader;
  /** 기본값: mock/sample_response_forecast.json */
  loadForecastFile?: ResponseFileLoader;
}

/**
 * 폴백으로 내려갈 때 모드별로 한 번만 경고를 남긴다(요청마다 찍으면 로그가 뒤덮인다).
 * 파일을 나중에 넣으면 다음 요청에서 파일 경로로 돌아가므로 플래그도 되돌린다.
 */
function makeFallbackWarner(): (mode: 'current' | 'forecast', message: string) => void {
  const warned = { current: false, forecast: false };
  return (mode, message) => {
    if (warned[mode]) return;
    warned[mode] = true;
    console.warn(`[compute:mock] ${mode} 응답 파일을 읽지 못해 합성 생성기로 대체합니다 — ${message}`);
  };
}

export function createMockComputeClient(opts: MockComputeClientOpts): ComputeClient {
  const loadCurrent = opts.loadCurrentFile ?? loadMockResponseCurrentFile;
  const loadForecast = opts.loadForecastFile ?? loadMockResponseForecastFile;
  const warnFallbackOnce = makeFallbackWarner();

  return {
    // mock 모드는 로컬에서 항상 동작하므로 health에서 ok로 본다(D-5).
    async ping(): Promise<boolean> {
      return true;
    },

    async requestCurrent(inputs: ComputeRequestInput[]): Promise<ComputeResult> {
      const last = inputs.at(-1);
      if (!last) {
        return { ok: false, code: 'UPSTREAM_ERROR', message: '연산 입력이 비어 있습니다.' };
      }

      // 1순위: 온도 측 응답 파일(range·geometryId 포함). 프레임이 1개라 시각만 바꿔 준다.
      const file = loadCurrent();
      if (file.ok) {
        const rebased = rebaseFrameTimes(file.data.frames, last.time, FORECAST_INTERVAL_MIN);
        if (rebased.ok) return { ...file.data, frames: rebased.frames };
        // 기준 시각 형식이 깨진 경우만 여기로 온다 — 폴백으로 내려가되 이유를 남긴다.
        warnFallbackOnce('current', rebased.message);
      } else {
        warnFallbackOnce('current', file.message);
      }

      const frame = generateMockFrame(last, opts.geometry);
      return {
        ok: true,
        requestId: 'mock',
        modelVersion: MOCK_MODEL_VERSION,
        frames: [frame],
      };
    },

    // ComputeClient.requestForecast는 extra(forecast_from·forecast_issued_at)를 받지만, mock은
    // 입력 시각만으로 프레임을 만들므로 두 번째 인자를 받지 않는다(TS 구조적 타이핑상
    // 인자가 더 적은 함수도 호환된다 — HttpComputeClient만 실제로 그 값을 요청 바디에 쓴다).
    async requestForecast(inputs: ComputeRequestInput[]): Promise<ComputeResult> {
      const startIdx = CURRENT_INPUT_COUNT - 1; // 마지막 실측(37번째, index 36) = 프레임 0
      const startInput = inputs[startIdx];

      // 1순위: 온도 측 응답 파일(145프레임). 프레임 0을 마지막 실측 시각에 맞추고 10분 간격으로
      // 다시 깐다 — 파일 자체도 같은 규칙(프레임 0 = 마지막 실측, 10분 간격)이라 구조는 그대로다.
      const file = loadForecast();
      if (file.ok && startInput) {
        const rebased = rebaseFrameTimes(file.data.frames, startInput.time, FORECAST_INTERVAL_MIN);
        if (rebased.ok) return { ...file.data, frames: rebased.frames };
        warnFallbackOnce('forecast', rebased.message);
      } else if (!file.ok) {
        warnFallbackOnce('forecast', file.message);
      }

      const frames: ComputeFrame[] = [];
      for (let i = 0; i < FORECAST_FRAME_COUNT; i += 1) {
        const idx = startIdx + i * FORECAST_FRAME_STEP_INPUTS;
        const input = inputs[idx];
        if (!input) {
          return {
            ok: false,
            code: 'UPSTREAM_ERROR',
            message: `연산 입력이 부족합니다(forecast는 최소 ${idx + 1}건 기대, 실제 ${inputs.length}건).`,
          };
        }
        frames.push(generateMockFrame(input, opts.geometry));
      }
      return {
        ok: true,
        requestId: 'mock',
        modelVersion: MOCK_MODEL_VERSION,
        frames,
      };
    },
  };
}
