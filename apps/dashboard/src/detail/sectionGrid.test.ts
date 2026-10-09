import { describe, expect, it } from 'vitest';
import { bilinearUpsample2x, extractZLayer, nearestZIndex } from './sectionGrid.js';
import type { GridDef } from '@ondo/shared';

describe('nearestZIndex', () => {
  const grid: GridDef = { origin: [0, 0, 0], spacing: [0.25, 0.25, 0.4], size: [19, 17, 8] };

  it('SECTION_Z_M=0.5는 z=0.4(k=1)에 가장 가깝다(05-open-questions.md #16)', () => {
    expect(nearestZIndex(grid, 0.5)).toBe(1);
  });

  it('정확히 grid 층 위에 있으면 그 층', () => {
    expect(nearestZIndex(grid, 0.8)).toBe(2);
  });

  it('범위를 넘는 높이는 가장 가까운 끝 층', () => {
    expect(nearestZIndex(grid, 100)).toBe(7);
  });
});

describe('extractZLayer', () => {
  it('인덱스 공식 i + nx*(j + ny*k)대로 x·y 평면을 꺼낸다', () => {
    const grid: GridDef = { origin: [0, 0, 0], spacing: [1, 1, 1], size: [2, 2, 2] };
    // k=0 층: idx 0,1,2,3 / k=1 층: idx 4,5,6,7
    const values = [0, 1, 2, 3, 10, 11, 12, 13];
    const layer0 = extractZLayer(values, grid, 0);
    expect(layer0).toEqual([
      [0, 2],
      [1, 3],
    ]);
    const layer1 = extractZLayer(values, grid, 1);
    expect(layer1).toEqual([
      [10, 12],
      [11, 13],
    ]);
  });
});

describe('bilinearUpsample2x', () => {
  it('2x2 입력 → 3x3 출력, 원본 모서리는 그대로 유지된다', () => {
    const layer = [
      [0, 10],
      [20, 30],
    ];
    const result = bilinearUpsample2x(layer);
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(3);
    expect(result[0]?.[0]).toBe(0);
    expect(result[0]?.[2]).toBe(10);
    expect(result[2]?.[0]).toBe(20);
    expect(result[2]?.[2]).toBe(30);
  });

  it('가운데 보간값은 네 모서리의 평균', () => {
    const layer = [
      [0, 10],
      [20, 30],
    ];
    const result = bilinearUpsample2x(layer);
    expect(result[1]?.[1]).toBeCloseTo((0 + 10 + 20 + 30) / 4, 5);
  });

  it('가장자리 중점은 두 인접값의 평균', () => {
    const layer = [
      [0, 10],
      [20, 30],
    ];
    const result = bilinearUpsample2x(layer);
    expect(result[0]?.[1]).toBeCloseTo((0 + 10) / 2, 5); // 위쪽 가장자리
    expect(result[1]?.[0]).toBeCloseTo((0 + 20) / 2, 5); // 왼쪽 가장자리
  });

  it('빈 입력은 빈 배열', () => {
    expect(bilinearUpsample2x([])).toEqual([]);
  });
});
