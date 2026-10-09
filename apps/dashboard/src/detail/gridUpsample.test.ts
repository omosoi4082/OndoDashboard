import { describe, expect, it } from 'vitest';
import { sampleGridTrilinear, upsampleGrid2xTrilinear, upsampledGridSize } from './gridUpsample.js';
import type { GridDef } from '@ondo/shared';

describe('upsampledGridSize', () => {
  it('2n-1 공식(n=1이면 그대로 1)', () => {
    expect(upsampledGridSize([19, 17, 8])).toEqual([37, 33, 15]);
    expect(upsampledGridSize([1, 1, 1])).toEqual([1, 1, 1]);
  });
});

describe('sampleGridTrilinear', () => {
  // 인덱스 공식 i + nx*(j + ny*k), docs/02-relay-api.md 5장.
  const size: [number, number, number] = [2, 2, 2];
  // k=0 층: 0,1,2,3 / k=1 층: 10,11,12,13 (x,y 순서는 extractZLayer 테스트와 동일 관례)
  const values = [0, 1, 2, 3, 10, 11, 12, 13];

  it('정수 좌표에서는 원본 값과 같다(8개 모서리)', () => {
    expect(sampleGridTrilinear(values, size, 0, 0, 0)).toBe(0);
    expect(sampleGridTrilinear(values, size, 1, 0, 0)).toBe(1);
    expect(sampleGridTrilinear(values, size, 0, 1, 0)).toBe(2);
    expect(sampleGridTrilinear(values, size, 1, 1, 0)).toBe(3);
    expect(sampleGridTrilinear(values, size, 0, 0, 1)).toBe(10);
    expect(sampleGridTrilinear(values, size, 1, 1, 1)).toBe(13);
  });

  it('정육면체 중심은 8개 모서리의 평균', () => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    expect(sampleGridTrilinear(values, size, 0.5, 0.5, 0.5)).toBeCloseTo(avg, 5);
  });

  it('범위를 벗어난 좌표는 가장 가까운 끝 값으로 clamp', () => {
    expect(sampleGridTrilinear(values, size, -5, 0, 0)).toBe(sampleGridTrilinear(values, size, 0, 0, 0));
    expect(sampleGridTrilinear(values, size, 5, 1, 1)).toBe(sampleGridTrilinear(values, size, 1, 1, 1));
  });
});

describe('upsampleGrid2xTrilinear', () => {
  it('2x2x2 입력 → 3x3x3 출력, 원본 모서리는 그대로 유지된다', () => {
    const grid: GridDef = { origin: [0, 0, 0], spacing: [1, 1, 1], size: [2, 2, 2] };
    const values = [0, 1, 2, 3, 10, 11, 12, 13];
    const { values: out, size } = upsampleGrid2xTrilinear(values, grid);
    expect(size).toEqual([3, 3, 3]);
    expect(out).toHaveLength(27);

    const idx = (i: number, j: number, k: number): number => i + 3 * (j + 3 * k);
    expect(out[idx(0, 0, 0)]).toBe(0);
    expect(out[idx(2, 0, 0)]).toBe(1);
    expect(out[idx(0, 2, 0)]).toBe(2);
    expect(out[idx(2, 2, 0)]).toBe(3);
    expect(out[idx(0, 0, 2)]).toBe(10);
    expect(out[idx(2, 2, 2)]).toBe(13);
  });

  it('가운데(2,2,2 출력 인덱스)는 8개 모서리의 평균', () => {
    const grid: GridDef = { origin: [0, 0, 0], spacing: [1, 1, 1], size: [2, 2, 2] };
    const values = [0, 1, 2, 3, 10, 11, 12, 13];
    const { values: out } = upsampleGrid2xTrilinear(values, grid);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    expect(out[1 + 3 * (1 + 3 * 1)]).toBeCloseTo(avg, 5);
  });

  it('높이 축(nz=1)은 업샘플하지 않는다', () => {
    const grid: GridDef = { origin: [0, 0, 0], spacing: [1, 1, 1], size: [2, 2, 1] };
    const values = [0, 1, 2, 3];
    const { values: out, size } = upsampleGrid2xTrilinear(values, grid);
    expect(size).toEqual([3, 3, 1]);
    expect(out).toHaveLength(9);
  });
});
