// technical-review/pig-farm-cfd-demo/src/overviewScene.js의 frameCameraToBox()를 포팅.
// 수학 로직은 그대로 두고(docs/07-starter-kit-assets.md), DOM/camera 객체를 직접 건드리는
// 부분만 분리해 순수 함수로 만들었다 — 호출 측(React 컴포넌트)에서 camera.position 등에 적용한다.
import * as THREE from 'three';

export interface CameraFrame {
  position: THREE.Vector3;
  target: THREE.Vector3;
  near: number;
  far: number;
}

/** 카메라가 center에서 어느 방향으로 떨어져 앉을지(각 축 비율) — technical-review/pig-farm-cfd-demo
 * overviewScene.js 원본 값. 메인 화면(OverviewScene)은 이와 별도로
 * OVERVIEW_CAMERA_DIRECTION(config/constants.ts)으로 자기만의 각도를 쓴다(2026-10-10 분리 —
 * 같은 함수를 메인 화면과 상세 패널 3D 뷰가 공유해서, 메인 화면 각도를 조정하면 상세 패널
 * 쪽도 같이 바뀌는 문제가 있었음). 상세 패널(Detail3DView)은 인자를 안 주면 이 기본값을 쓴다.
 */
export const DEFAULT_CAMERA_DIRECTION: THREE.Vector3Tuple = [0.433, 0.379, 0.462];

/**
 * box가 화면에 들어오도록 카메라 위치·시야를 계산한다. rotationCenter를 따로 주면
 * 줌 거리(box 크기 기준)는 그대로 두고 회전 중심만 그 지점으로 옮긴다(기본은 box 중심).
 * direction은 center에서 카메라를 띄우는 축별 비율([x,y,z], 기본 DEFAULT_CAMERA_DIRECTION).
 */
export function computeCameraFrame(
  box: THREE.Box3,
  marginFactor = 1.4,
  rotationCenter?: THREE.Vector3,
  direction: THREE.Vector3Tuple = DEFAULT_CAMERA_DIRECTION,
): CameraFrame {
  const size = new THREE.Vector3();
  box.getSize(size);
  const boxCenter = new THREE.Vector3();
  box.getCenter(boxCenter);
  const center = rotationCenter ?? boxCenter;

  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const dist = maxDim * marginFactor;

  const [dx, dy, dz] = direction;
  const position = new THREE.Vector3(
    center.x + dist * dx,
    center.y + dist * dy,
    center.z + dist * dz,
  );

  return {
    position,
    target: center.clone(),
    near: Math.max(0.1, dist / 200),
    far: dist * 10,
  };
}
