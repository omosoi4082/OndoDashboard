// 3D 격자 2배 삼선형 보간(01-functional-spec.md 3장 "온도·습도: grid를 2배 삼선형 보간 →
// marching cubes 등치면"). sectionGrid.ts의 2D 쌍선형 보간(bilinearUpsample2x)과 같은
// 방식을 z축까지 확장한 버전 — 원본 샘플 좌표는 그대로 유지하고 그 사이 격자점에 보간값을
// 끼워 넣는다(입력 nx*ny*nz → 출력 (2nx-1)*(2ny-1)*(2nz-1)).
//
// 인덱스 공식은 docs/02-relay-api.md 5장 "격자 1차원 인덱스: i + nx*(j + ny*k)"를 그대로
// 따른다 — 원본 grid든 업샘플된 grid든 같은 공식을 쓴다(크기만 다르다).
//
// sampleGridTrilinear는 2배 업샘플(고정 간격 0.5 step) 외에도 scene/IsosurfaceVolume.tsx가
// MarchingCubes의 정육면체 field로 다시 리샘플링할 때 임의 연속 좌표에서 값을 뽑는 용도로도
// 재사용한다(detail/isosurfaceField.ts).
import type { GridDef } from '@ondo/shared';

export interface UpsampledGrid {
  values: Float32Array;
  size: [number, number, number];
}

/** flat 배열에서 (i,j,k) 정수 인덱스의 값을 꺼낸다(경계 밖이면 가장 가까운 유효 인덱스로 clamp). */
function at(values: ArrayLike<number>, size: readonly [number, number, number], i: number, j: number, k: number): number {
  const [nx, ny] = size;
  return values[i + nx * (j + ny * k)] ?? 0;
}

/**
 * 연속 좌표(x,y,z — 각 축 0~size[axis]-1 범위의 격자 인덱스 단위)에서 삼선형 보간한 값을
 * 뽑는다. 범위를 벗어나면 가장 가까운 끝 값으로 clamp한다(bilinearUpsample2x와 동일 정책).
 */
export function sampleGridTrilinear(
  values: ArrayLike<number>,
  size: readonly [number, number, number],
  x: number,
  y: number,
  z: number,
): number {
  const [nx, ny, nz] = size;
  const cx = Math.min(Math.max(x, 0), Math.max(nx - 1, 0));
  const cy = Math.min(Math.max(y, 0), Math.max(ny - 1, 0));
  const cz = Math.min(Math.max(z, 0), Math.max(nz - 1, 0));

  const x0 = Math.floor(cx);
  const x1 = Math.min(x0 + 1, nx - 1);
  const tx = cx - x0;
  const y0 = Math.floor(cy);
  const y1 = Math.min(y0 + 1, ny - 1);
  const ty = cy - y0;
  const z0 = Math.floor(cz);
  const z1 = Math.min(z0 + 1, nz - 1);
  const tz = cz - z0;

  const c00 = at(values, size, x0, y0, z0) * (1 - tx) + at(values, size, x1, y0, z0) * tx;
  const c10 = at(values, size, x0, y1, z0) * (1 - tx) + at(values, size, x1, y1, z0) * tx;
  const c01 = at(values, size, x0, y0, z1) * (1 - tx) + at(values, size, x1, y0, z1) * tx;
  const c11 = at(values, size, x0, y1, z1) * (1 - tx) + at(values, size, x1, y1, z1) * tx;
  const c0 = c00 * (1 - ty) + c10 * ty;
  const c1 = c01 * (1 - ty) + c11 * ty;
  return c0 * (1 - tz) + c1 * tz;
}

/** 업샘플 후 각 축 크기(2n-1, n<=1이면 그대로 1) — 원본과 업샘플 양쪽에서 일관되게 쓴다. */
export function upsampledGridSize(size: readonly [number, number, number]): [number, number, number] {
  const [nx, ny, nz] = size;
  return [nx > 1 ? nx * 2 - 1 : 1, ny > 1 ? ny * 2 - 1 : 1, nz > 1 ? nz * 2 - 1 : 1];
}

/** grid(frame.grid.temp 또는 .rh, 길이 nx*ny*nz)를 2배 삼선형 보간한다. */
export function upsampleGrid2xTrilinear(values: readonly number[], grid: GridDef): UpsampledGrid {
  const [nx, ny, nz] = grid.size;
  const [outNx, outNy, outNz] = upsampledGridSize(grid.size);
  const out = new Float32Array(outNx * outNy * outNz);

  for (let k = 0; k < outNz; k += 1) {
    const gz = nz > 1 ? k / 2 : 0;
    for (let j = 0; j < outNy; j += 1) {
      const gy = ny > 1 ? j / 2 : 0;
      for (let i = 0; i < outNx; i += 1) {
        const gx = nx > 1 ? i / 2 : 0;
        out[i + outNx * (j + outNy * k)] = sampleGridTrilinear(values, grid.size, gx, gy, gz);
      }
    }
  }

  return { values: out, size: [outNx, outNy, outNz] };
}
