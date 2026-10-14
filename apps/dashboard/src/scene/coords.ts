// 좌표 변환(데이터 z-up → Three.js y-up)은 이 파일 한 곳에서만 처리한다 (CLAUDE.md 규칙).
//
// 데이터 좌표계(docs/02-relay-api.md 5장): 자돈방 바닥 모서리 원점, m 단위,
// x = 길이(서→동), y = 폭(배기구 벽 y=0 → 맞은편 벽), z = 높이(위쪽). 원점은 배기구 벽의 서쪽
// 바닥 모서리. Three.js는 y가 위쪽이므로 X축 -90° 회전으로 옮긴다: (x, y, z) → (x, z, −y).
//
// 2026-10-14 수정(B-9 재검토): 전에는 y·z를 맞바꾸기만((x, z, y)) 했는데, 축 두 개를 맞바꾸는 건
// 회전이 아니라 **반사**라 3D가 실제 돈방의 거울상이 됐다. 돈방 모델(p1.glb)은 처음부터
// (x, z, −y)로 만들어져 있어(배기구 z≈0, 급기구 z = −0.8/−1.98/−3.15, 칸막이 갈림 z = −3.62)
// 데이터 포인트만 모델과 반대쪽에 겹쳐 그려지고 있었다. 위에서 내려다보면 이제 온도 측 평면도
// (그림 1: x 오른쪽, y 위쪽, y = 0이 아래)와 같은 방향이다.
// 결과적으로 방 박스는 Three.js에서 x 0~w, y 0~h, **z −d~0**이다.
//
// 점·방향 벡터(유동 vx,vy,vz 포함)는 zUpToYUp, 길이(크기)는 부호가 없어야 하므로 sizeZUpToYUp을 쓴다.
// 상세보기 전용이다 — 메인 화면 모델(scene/barnModel.ts)은 처음부터 Three 공간이라 쓰지 않는다.

export type Vec3 = readonly [number, number, number];

/** 데이터 좌표(x, y, z-위) → Three.js 좌표(x, y-위, −y). 점과 방향 벡터에 쓴다. */
export function zUpToYUp([x, y, z]: Vec3): [number, number, number] {
  return [x, z, -y];
}

/** 데이터 크기(길이 x, 폭 y, 높이 z) → Three.js 크기(x, y-위, z). 길이라 부호를 뒤집지 않는다. */
export function sizeZUpToYUp([x, y, z]: Vec3): [number, number, number] {
  return [x, z, y];
}

/** 데이터 좌표계의 축대칭 박스(중심·크기) → Three.js 박스(position·size)로 변환. */
export function dataBoxToThree(
  center: Vec3,
  size: Vec3,
): { position: [number, number, number]; size: [number, number, number] } {
  return { position: zUpToYUp(center), size: sizeZUpToYUp(size) };
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
 * Three.js(y-up) 방 박스(x 0~w, y 0~h, z −d~0)로 옮길 때 쓴다. 정점 단위로 zUpToYUp을 적용할
 * 수 없는 경우를 위한 "그룹(Object3D) 단위" 버전이며, 이 파일(coords.ts) 바깥에서 좌표 변환을
 * 새로 만들지 않기 위해 여기 둔다(CLAUDE.md "좌표 변환은 coords.ts 한 곳에서만").
 *
 * 유도: 로컬 점 p=(lx,ly,lz)∈[-1,1]^3에 scale=(sx,sy,sz)/2를 곱하고 X축으로 -90° 회전하면
 * (lx*sx/2, lz*sz/2, -ly*sy/2)가 되고, position=(sx/2, sz/2, -sy/2)를 더하면
 * (data x, data z, −data y) — zUpToYUp과 정확히 같은 변환이다(coords.test.ts에 양끝 모서리로 검증).
 */
export function zUpVolumeGroupTransform(size: Vec3): VolumeGroupTransform {
  const [sx, sy, sz] = size;
  return {
    position: [sx / 2, sz / 2, -sy / 2],
    scale: [sx / 2, sy / 2, sz / 2],
    rotationX: -Math.PI / 2,
  };
}
