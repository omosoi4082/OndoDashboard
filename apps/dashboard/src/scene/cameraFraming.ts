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

/**
 * box가 화면에 들어오도록 카메라 위치·시야를 계산한다. rotationCenter를 따로 주면
 * 줌 거리(box 크기 기준)는 그대로 두고 회전 중심만 그 지점으로 옮긴다(기본은 box 중심).
 */
export function computeCameraFrame(
  box: THREE.Box3,
  marginFactor = 1.4,
  rotationCenter?: THREE.Vector3,
): CameraFrame {
  const size = new THREE.Vector3();
  box.getSize(size);
  const boxCenter = new THREE.Vector3();
  box.getCenter(boxCenter);
  const center = rotationCenter ?? boxCenter;

  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const dist = maxDim * marginFactor;

  const position = new THREE.Vector3(
    center.x + dist * 0.433,
    center.y + dist * 0.379,
    center.z + dist * 0.462,
  );

  return {
    position,
    target: center.clone(),
    near: Math.max(0.1, dist / 200),
    far: dist * 10,
  };
}
