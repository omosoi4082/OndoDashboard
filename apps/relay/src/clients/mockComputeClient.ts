// docs/03-upstream-apis.md 4.3 Mock. COMPUTE_MODE=mock일 때 쓰는 ComputeClient 구현.
// current: 입력 중 마지막 시각의 프레임 1개만 생성(docs/03 4.2 "frames: current 1개(마지막
// 입력 시각)"). 실제 생성 로직은 transforms/mockComputeGen.ts(순수 함수, 단위 테스트 있음).
// forecast: 마지막 실측 시각(37번째 입력, index 36)부터 10분 간격 145개(docs/02 5장) — 325건
// 입력(5분 간격) 중 짝수 간격으로 선택해 같은 generateMockFrame으로 결정적으로 생성한다.
import type { Geometry } from '@ondo/shared';
import type { ComputeClient, ComputeFrame, ComputeRequestInput, ComputeResult } from './computeClient.js';
import { generateMockFrame } from '../transforms/mockComputeGen.js';

const MOCK_MODEL_VERSION = 'mock-v1';
const CURRENT_INPUT_COUNT = 37; // docs/02-relay-api.md 6장
const FORECAST_FRAME_COUNT = 145; // docs/02-relay-api.md 5장(0~1,440분, 10분 간격)
const FORECAST_FRAME_STEP_INPUTS = 2; // 10분 간격 / 5분 입력 간격

export function createMockComputeClient(opts: { geometry: Geometry }): ComputeClient {
  return {
    async requestCurrent(inputs: ComputeRequestInput[]): Promise<ComputeResult> {
      const last = inputs.at(-1);
      if (!last) {
        return { ok: false, code: 'UPSTREAM_ERROR', message: '연산 입력이 비어 있습니다.' };
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
    // 입력 시각만으로 프레임을 생성하므로 두 번째 인자를 받지 않는다(TS 구조적 타이핑상
    // 인자가 더 적은 함수도 호환된다 — HttpComputeClient만 실제로 그 값을 요청 바디에 쓴다).
    async requestForecast(inputs: ComputeRequestInput[]): Promise<ComputeResult> {
      const startIdx = CURRENT_INPUT_COUNT - 1; // 마지막 실측(37번째, index 36)
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
