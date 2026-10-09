// docs/03-upstream-apis.md 4.3 Mock. requestForecast: 325건 입력 중 마지막 실측(index 36)부터
// 10분 간격(5분 입력 2개 간격)으로 145개 프레임을 고른다.
import { describe, expect, it } from 'vitest';
import type { Geometry } from '@ondo/shared';
import { createMockComputeClient } from './mockComputeClient.js';
import type { ComputeRequestInput } from './computeClient.js';

const GEOMETRY: Geometry = {
  geometryId: 'test-geometry',
  room: { size: [4, 4, 2] },
  points: [{ id: 0, x: 0.5, y: 0.5, z: 0.5 }],
  grid: { origin: [0, 0, 0], spacing: [1, 1, 1], size: [2, 2, 2] },
  flowGrid: { origin: [0.5, 0.5, 0.5], spacing: [2, 2, 1], size: [1, 1, 1] },
};

function makeInputs(count: number): ComputeRequestInput[] {
  const inputs: ComputeRequestInput[] = [];
  for (let i = 0; i < count; i += 1) {
    inputs.push({ time: `2026-10-05T12:${String(i).padStart(2, '0')}:00`, T_out: 20 + i * 0.01, RH_out: 65, fan_pct: 50 });
  }
  return inputs;
}

const EXTRA = { forecastFrom: '2026-10-05T15:25:00', forecastIssuedAt: '2026-10-05T14:00:00' };

describe('createMockComputeClient.requestForecast', () => {
  it('325건 입력이면 145개 프레임을 생성한다', async () => {
    const client = createMockComputeClient({ geometry: GEOMETRY });
    const result = await client.requestForecast(makeInputs(325), EXTRA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frames).toHaveLength(145);
  });

  it('첫 프레임은 37번째 입력(index 36)을 쓴다', async () => {
    const client = createMockComputeClient({ geometry: GEOMETRY });
    const inputs = makeInputs(325);
    const result = await client.requestForecast(inputs, EXTRA);
    if (!result.ok) throw new Error('expected ok');
    expect(result.frames[0]?.time).toBe(inputs[36]?.time);
    expect(result.frames[1]?.time).toBe(inputs[38]?.time); // 10분 간격 = 5분 입력 2칸
    expect(result.frames[144]?.time).toBe(inputs[36 + 144 * 2]?.time);
  });

  it('입력이 부족하면(325건 미달) 에러', async () => {
    const client = createMockComputeClient({ geometry: GEOMETRY });
    const result = await client.requestForecast(makeInputs(100), EXTRA);
    expect(result.ok).toBe(false);
  });

  it('결정적이다(같은 입력이면 같은 출력)', async () => {
    const client = createMockComputeClient({ geometry: GEOMETRY });
    const inputs = makeInputs(325);
    const a = await client.requestForecast(inputs, EXTRA);
    const b = await client.requestForecast(inputs, EXTRA);
    expect(a).toEqual(b);
  });
});
