import { describe, expect, it } from 'vitest';
import { fieldValueRange, fillCubeField, isosurfaceCubeResolution, levelIsolations } from './isosurfaceField.js';

describe('isosurfaceCubeResolution', () => {
  it('가장 큰 축 크기를 고른다', () => {
    expect(isosurfaceCubeResolution([37, 33, 15])).toBe(37);
  });
});

describe('fieldValueRange', () => {
  it('field의 실제 min~max를 돌려준다', () => {
    // Float32Array는 26.6을 정확히 담지 못하므로(26.60000038…) 근삿값으로 비교한다.
    const { min, max } = fieldValueRange(new Float32Array([26.6, 29.1, 27.4]));
    expect(min).toBeCloseTo(26.6, 5);
    expect(max).toBeCloseTo(29.1, 5);
  });

  it('값이 하나뿐이면 min===max', () => {
    expect(fieldValueRange([5])).toEqual({ min: 5, max: 5 });
  });

  it('빈 배열이면 0~0', () => {
    expect(fieldValueRange([])).toEqual({ min: 0, max: 0 });
  });

  it('전체 range가 아니라 프레임 범위로 단계를 잡으면 모든 단계가 값 폭 안에 들어온다', () => {
    // 예측 모드 실제 상황: 응답 range 19~29.5(24시간 외기 변화), 프레임 값 폭 26.6~29.1.
    const frame = new Float32Array([26.6, 27.3, 28.0, 28.6, 29.1]);
    const whole = levelIsolations({ min: 19, max: 29.5 }, 4);
    const perFrame = levelIsolations(fieldValueRange(frame), 4);
    const inside = (levels: number[]): number => levels.filter((v) => v > 26.6 && v < 29.1).length;
    expect(inside(whole)).toBe(1); // 전체 range 기준이면 1단계만 걸린다(= 메쉬가 거의 안 보임)
    expect(inside(perFrame)).toBe(4);
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
