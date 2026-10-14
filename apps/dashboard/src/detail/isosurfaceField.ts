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
 * 이 프레임 field의 실제 최솟값·최댓값. 등치면 임계값을 응답 전체 range가 아니라 프레임 자체
 * 범위에서 뽑기 위해 쓴다(2026-10-14, docs/05-open-questions.md #47).
 *
 * 왜 필요한가: 예측·전문가·제어 응답의 `range`는 145프레임 전체(예측은 24시간 외기 변화)를
 * 덮는 범위라, 한 프레임의 실내 값 폭(2~3 ℃)보다 훨씬 넓다. 전체 range로 4단계를 균등하게
 * 잡으면 그중 보통 한 단계만 프레임 값 폭에 걸리고, 그것도 프레임의 끝값 근처라 표면이 거의
 * 생기지 않는다(예측 mock frame 0: 삼각형 196개 — 현재 모드 9,264개 대비 2%, 화면상 안 보임).
 * 색은 그대로 전체 range 기준으로 칠해서 절대값 비교는 유지한다(scene/IsosurfaceVolume.tsx).
 *
 * 빈 배열이면 {min:0,max:0}을 돌려준다(호출 측에서 span<=0으로 처리된다).
 */
export function fieldValueRange(values: ArrayLike<number>): MinMax {
  if (values.length === 0) return { min: 0, max: 0 };
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i] ?? 0;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
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
