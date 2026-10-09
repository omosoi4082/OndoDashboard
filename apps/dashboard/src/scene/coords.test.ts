import { describe, expect, it } from 'vitest';
import { dataBoxToThree, zUpToYUp, zUpVolumeGroupTransform, type VolumeGroupTransform } from './coords.js';

describe('zUpToYUp', () => {
  it('y·z를 맞바꾼다(x는 그대로)', () => {
    expect(zUpToYUp([1, 2, 3])).toEqual([1, 3, 2]);
  });

  it('0벡터는 그대로 0벡터', () => {
    expect(zUpToYUp([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe('dataBoxToThree', () => {
  it('중심·크기 둘 다 y/z를 맞바꾼다', () => {
    const result = dataBoxToThree([2.25, 0, 1.6], [0.4, 0.1, 0.4]);
    expect(result.position).toEqual([2.25, 1.6, 0]);
    expect(result.size).toEqual([0.4, 0.4, 0.1]);
  });
});

// three.js 없이 순수 숫자로 Object3D 합성을 흉내낸다: 스케일 → X축 -90° 회전 → 이동
// (rotationX=-90°는 cos=0, sin=-1이라 부동소수 오차 없이 정확히 (x, z, -y)가 된다).
function applyVolumeTransform(transform: VolumeGroupTransform, local: readonly [number, number, number]): [number, number, number] {
  const [lx, ly, lz] = local;
  const [sx, sy, sz] = transform.scale;
  const scaled: [number, number, number] = [lx * sx, ly * sy, lz * sz];
  const rotated: [number, number, number] = [scaled[0], scaled[2], -scaled[1]];
  const [px, py, pz] = transform.position;
  return [rotated[0] + px, rotated[1] + py, rotated[2] + pz];
}

describe('zUpVolumeGroupTransform', () => {
  const roomSize: [number, number, number] = [4.5, 4.0, 2.8];
  const transform = zUpVolumeGroupTransform(roomSize);

  it('로컬 (-1,-1,-1)(데이터 원점)은 Three.js 원점(0,0,0)으로 간다', () => {
    const p = applyVolumeTransform(transform, [-1, -1, -1]);
    expect(p[0]).toBeCloseTo(0, 6);
    expect(p[1]).toBeCloseTo(0, 6);
    expect(p[2]).toBeCloseTo(0, 6);
  });

  it('로컬 (1,1,1)(데이터 반대쪽 모서리)은 zUpToYUp(room.size)로 간다', () => {
    const p = applyVolumeTransform(transform, [1, 1, 1]);
    const expected = zUpToYUp(roomSize);
    expect(p[0]).toBeCloseTo(expected[0], 6);
    expect(p[1]).toBeCloseTo(expected[1], 6);
    expect(p[2]).toBeCloseTo(expected[2], 6);
  });

  it('로컬 (1,-1,-1)(데이터 x만 끝)은 zUpToYUp([roomX,0,0])로 간다', () => {
    const p = applyVolumeTransform(transform, [1, -1, -1]);
    expect(p[0]).toBeCloseTo(roomSize[0], 6);
    expect(p[1]).toBeCloseTo(0, 6);
    expect(p[2]).toBeCloseTo(0, 6);
  });
});
