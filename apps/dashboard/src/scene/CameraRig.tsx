// technical-review/pig-farm-cfd-demo/src/overviewScene.js의 카메라 리그를 포팅
// (docs/07-starter-kit-assets.md) — OrbitControls 생성·zoomToCursor=true, 모델
// bounding box에 맞춘 초기 카메라 프레이밍(frameCameraToBox → computeCameraFrame).
// 커스텀 "클릭/드래그 지점으로 pivot 이동" 기능은 데모에서 최종적으로 폐기된 것이라
// 가져오지 않는다 — stock OrbitControls + zoomToCursor만 쓴다.
import { useEffect, useRef, type ReactElement } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { computeCameraFrame } from './cameraFraming.js';
import { metersPerPixel, pickScaleBar } from './scaleBar.js';
import { OVERVIEW_CAMERA_MARGIN_FACTOR, SCALE_BAR_TARGET_PX } from '../config/constants.js';
import { useMainStore } from '../store/mainStore.js';

interface CameraRigProps {
  /** 프레이밍 기준 박스 — 로드된 glb의 sections(자돈·육성·비육) 합집합(scene/barnModel.ts). */
  box: THREE.Box3;
  /** 회전 중심을 box 중심 대신 이 지점으로 둔다(자돈방 쪽으로 치우친 지점, 선택값). */
  rotationCenter?: THREE.Vector3;
}

export function CameraRig({ box, rotationCenter }: CameraRigProps): ReactElement {
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const setScaleBar = useMainStore((s) => s.setScaleBar);

  useEffect(() => {
    const frame = computeCameraFrame(box, OVERVIEW_CAMERA_MARGIN_FACTOR, rotationCenter);

    camera.position.copy(frame.position);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.near = frame.near;
      camera.far = frame.far;
      camera.updateProjectionMatrix();
    }
    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(frame.target);
      controls.update();
    }
    updateScaleBar();
    // box/rotationCenter는 모델 로드 후 1회 계산되는 고정값 — 처음 프레이밍할 때만 적용한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, box, rotationCenter]);

  // 축척(8번 영역) — 카메라 줌(거리)에 따라 막대 길이·라벨을 갱신한다
  // (01-functional-spec.md 2장 #8). OrbitControls의 change 이벤트(줌·회전·이동)마다 재계산.
  function updateScaleBar(): void {
    const controls = controlsRef.current;
    if (!controls || !(camera instanceof THREE.PerspectiveCamera)) return;
    const distance = camera.position.distanceTo(controls.target);
    const mpp = metersPerPixel(distance, camera.fov, size.height);
    setScaleBar(pickScaleBar(mpp, SCALE_BAR_TARGET_PX));
  }

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      zoomToCursor
      makeDefault
      onChange={updateScaleBar}
    />
  );
}
