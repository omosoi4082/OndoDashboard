// 예측·전문가·제어 모드 3D 등치면(IsosurfaceVolume.tsx)의 순수 계산부 — three-stdlib의
// MarchingCubes는 정육면체 해상도(size=size2=size3, node_modules/three-stdlib/objects/
// MarchingCubes.js init())만 지원하므로, 2배 업샘플된 비정육면체 grid(nx≠ny≠nz)를 그
// 해상도의 정육면체 field(Float32Array, 길이 resolution^3)로 다시 리샘플링해야 한다.
// 인덱스 공식은 MarchingCubes 내부 규약(x + y*size + z*size*size, yd=size/zd=size*size)과
// 맞춰야 한다(docs/07-starter-kit-assets.md volumeField.js 주석 "idx = i + j*size +
// k*size*size"도 같은 규약).
import type { MinMax } from '@ondo/shared';
import { sampleGridTrilinear } from './gridUpsample.js';

/** MarchingCubes 생성자에 넘길 정육면체 해상도 — 업샘플된 grid의 가장 큰 축 크기. */
export function isosurfaceCubeResolution(upsampledSize: readonly [number, number, number]): number {
  return Math.max(...upsampledSize);
}

/**
 * range.min~max 사이에 levelCount개의 등치면 임계값을 균등하게 둔다(양 끝은 피한다 —
 * 끝값과 같으면 표면이 거의 생기지 않거나 방 전체를 채워버린다).
 */
export function levelIsolations(range: MinMax, levelCount: number): number[] {
  const span = range.max - range.min;
  if (levelCount <= 0) return [];
  if (span <= 0) return Array.from({ length: levelCount }, () => range.min);
  return Array.from({ length: levelCount }, (_, i) => range.min + span * ((i + 1) / (levelCount + 1)));
}

/**
 * 업샘플된 grid(values, size)를 resolution^3 정육면체 field로 리샘플링해 out에 채운다
 * (out은 호출 측이 재사용하는 스크래치 버퍼 — 매 프레임 새로 할당하지 않는다).
 * 비정육면체 grid를 다루는 부분이라, 각 축을 독립적으로 0~size[axis]-1 범위에 맞춰
 * 샘플링한다(실제 물리적 비율은 scene/coords.ts의 zUpVolumeGroupTransform이 그룹 스케일로
 * 다시 맞춘다).
 */
export function fillCubeField(
  out: Float32Array,
  resolution: number,
  values: ArrayLike<number>,
  size: readonly [number, number, number],
): void {
  const [nx, ny, nz] = size;
  for (let cz = 0; cz < resolution; cz += 1) {
    const gz = resolution > 1 ? (cz / (resolution - 1)) * (nz - 1) : 0;
    for (let cy = 0; cy < resolution; cy += 1) {
      const gy = resolution > 1 ? (cy / (resolution - 1)) * (ny - 1) : 0;
      for (let cx = 0; cx < resolution; cx += 1) {
        const gx = resolution > 1 ? (cx / (resolution - 1)) * (nx - 1) : 0;
        out[cx + resolution * (cy + resolution * cz)] = sampleGridTrilinear(values, size, gx, gy, gz);
      }
    }
  }
}
