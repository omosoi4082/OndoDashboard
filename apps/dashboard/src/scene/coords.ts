// 좌표 변환(데이터 z-up → Three.js y-up)은 이 파일 한 곳에서만 처리한다 (CLAUDE.md 규칙).
//
// 데이터 좌표계(docs/02-relay-api.md 5장): 자돈방 바닥 모서리 원점, m 단위,
// x = 길이, y = 폭, z = 높이(위쪽). Three.js는 y가 위쪽이므로 y·z를 맞바꾼다.
// 이 교환 공식은 "점(위치)"뿐 아니라 "크기(가로/깊이/높이 길이)" 벡터에도 그대로
// 적용된다(각 축 성분을 그대로 옮기는 것뿐이라 점이든 길이든 동일) — 그래서
// 아래 하나의 함수를 두 용도 모두에 재사용한다.

export type Vec3 = readonly [number, number, number];

/** 데이터 좌표(x, y, z-위) → Three.js 좌표(x, y-위, z). 점·크기(길이) 벡터 양쪽에 쓴다. */
export function zUpToYUp([x, y, z]: Vec3): [number, number, number] {
  return [x, z, y];
}

/** 데이터 좌표계의 축대칭 박스(중심·크기) → Three.js 박스(position·size)로 변환. */
export function dataBoxToThree(
  center: Vec3,
  size: Vec3,
): { position: [number, number, number]; size: [number, number, number] } {
  return { position: zUpToYUp(center), size: zUpToYUp(size) };
}

export interface VolumeGroupTransform {
  position: [number, number, number];
  scale: [number, number, number];
  /** X축 회전(라디안) — y·z를 맞바꾸는 zUpToYUp과 동일한 효과를 Object3D 변환으로 낸다. */
  rotationX: number;
}

/**
 * three-stdlib의 MarchingCubes처럼 정점 하나하나를 우리가 직접 계산하지 않고 라이브러리가
 * 통째로 만들어 주는 지오메트리(로컬 좌표 범위 [-1,1]^3, data 축 순서 그대로 x·y·z)를
 * Three.js(y-up) room box(0~size.x, 0~size.z, 0~size.y)로 옮길 때 쓴다. 정점 단위로
 * zUpToYUp을 적용할 수 없는 경우를 위한 "그룹(Object3D) 단위" 버전이며, 이 파일(coords.ts)
 * 바깥에서 좌표 변환을 새로 만들지 않기 위해 여기 둔다(CLAUDE.md "좌표 변환은 coords.ts
 * 한 곳에서만").
 *
 * 유도: 로컬 점 p=(lx,ly,lz)∈[-1,1]^3에 scale=(sx,-sy,sz)를 곱하고 X축으로 -90° 회전하면
 * (lx*sx, lz*sz, -ly*(-sy)) = (lx*sx, lz*sz, ly*sy)가 되고, 여기에 position(각 축 half-extent)을
 * 더하면 결국 (data x, data z, data y) 순서로 재배치된다 — zUpToYUp([x,y,z]) = [x,z,y]와
 * 정확히 같은 축 재배치다(coords.test.ts에 양끝 모서리로 검증).
 */
export function zUpVolumeGroupTransform(size: Vec3): VolumeGroupTransform {
  const [sx, sy, sz] = size;
  const [px, py, pz] = zUpToYUp(size);
  return {
    position: [px / 2, py / 2, pz / 2],
    scale: [sx / 2, -sy / 2, sz / 2],
    rotationX: -Math.PI / 2,
  };
}
