import { describe, expect, it } from 'vitest';
import { fillCubeField, isosurfaceCubeResolution, levelIsolations } from './isosurfaceField.js';

describe('isosurfaceCubeResolution', () => {
  it('가장 큰 축 크기를 고른다', () => {
    expect(isosurfaceCubeResolution([37, 33, 15])).toBe(37);
  });
});

describe('levelIsolations', () => {
  it('range 양 끝을 피해 균등 분포(4단계)', () => {
    const levels = levelIsolations({ min: 0, max: 10 }, 4);
    expect(levels).toHaveLength(4);
    expect(levels).toEqual([2, 4, 6, 8]);
  });

  it('min===max(평탄)면 모든 단계가 min', () => {
    expect(levelIsolations({ min: 5, max: 5 }, 3)).toEqual([5, 5, 5]);
  });

  it('levelCount<=0이면 빈 배열', () => {
    expect(levelIsolations({ min: 0, max: 10 }, 0)).toEqual([]);
  });
});

describe('fillCubeField', () => {
  it('2x2x2 grid를 3x3x3 큐브로 리샘플링하면 모서리 값이 보존된다', () => {
    const size: [number, number, number] = [2, 2, 2];
    const values = [0, 1, 2, 3, 10, 11, 12, 13];
    const resolution = 3;
    const out = new Float32Array(resolution ** 3);
    fillCubeField(out, resolution, values, size);

    const idx = (x: number, y: number, z: number): number => x + resolution * (y + resolution * z);
    expect(out[idx(0, 0, 0)]).toBeCloseTo(0, 5);
    expect(out[idx(2, 0, 0)]).toBeCloseTo(1, 5);
    expect(out[idx(0, 2, 0)]).toBeCloseTo(2, 5);
    expect(out[idx(0, 0, 2)]).toBeCloseTo(10, 5);
    expect(out[idx(2, 2, 2)]).toBeCloseTo(13, 5);
  });

  it('비정육면체 grid(nx≠ny≠nz)도 각 축을 독립적으로 리샘플링한다', () => {
    const size: [number, number, number] = [2, 3, 1];
    // i + 2*(j + 3*k), k=0뿐
    const values = [0, 1, 2, 3, 4, 5];
    const resolution = 4;
    const out = new Float32Array(resolution ** 3);
    fillCubeField(out, resolution, values, size);

    // z축은 항상 0층(gz=0 고정, nz=1)이므로 cz와 무관하게 같은 값이어야 한다.
    const idx = (x: number, y: number, z: number): number => x + resolution * (y + resolution * z);
    expect(out[idx(0, 0, 0)]).toBeCloseTo(out[idx(0, 0, 3)] ?? NaN, 5);
  });
});
