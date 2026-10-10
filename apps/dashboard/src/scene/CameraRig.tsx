// technical-review/pig-farm-cfd-demo/src/overviewScene.js의 카메라 리그를 포팅
// (docs/07-starter-kit-assets.md) — OrbitControls 생성·zoomToCursor=true, 모델
// bounding box에 맞춘 초기 카메라 프레이밍(frameCameraToBox → computeCameraFrame).
// 주의: "드래그할 때마다 클릭/드래그 지점으로 pivot을 옮기는" 기능은 데모에서 화면이
// 튀는("뜅기는") 문제로 최종 폐기된 것이라 가져오지 않는다 — 절대 다시 넣지 말 것
// (시도했다 되돌린 이력: 9ba9c1b → 402d82f). 아래 "보이는 영역 중앙 피벗"은 그것과
// 다르다 — 프레이밍(모델 로드) 시점에 딱 한 번만 계산하고 드래그 중에는 건드리지 않는다.
import { useEffect, useRef, type ReactElement } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { computeCameraFrame } from './cameraFraming.js';
import { metersPerPixel, pickScaleBar } from './scaleBar.js';
import { DETAIL_PANEL_WIDTH_PX, OVERVIEW_CAMERA_MARGIN_FACTOR, SCALE_BAR_TARGET_PX } from '../config/constants.js';
import { useMainStore } from '../store/mainStore.js';

interface CameraRigProps {
  /** 프레이밍 기준 박스 — 로드된 glb의 sections(자돈·육성·비육) 합집합(scene/barnModel.ts). */
  box: THREE.Box3;
  /** 회전 중심 fallback — 레이캐스트가 모델에 안 맞을 때만 쓴다(box 중심 대신 자돈방 쪽으로
   * 치우친 지점, 선택값). */
  rotationCenter?: THREE.Vector3;
}

export function CameraRig({ box, rotationCenter }: CameraRigProps): ReactElement {
  const { camera, size, scene } = useThree();
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

      // 2026-10-10 사용자 요청: 회전 피벗을 "방 중심"이 아니라 "상세 패널에 가려지지 않는
      // 보이는 영역의 화면 중앙"이 가리키는 지점으로. 캔버스가 화면 전체 폭이라 타겟은
      // 항상 캔버스 전체 중앙으로 투영되는데, 실제 보이는 영역 중앙은 그보다 왼쪽이라
      // 위에서 구한 fallback 타겟으로 일단 카메라를 겨냥시킨 다음, 그 상태에서 보이는
      // 영역 중앙 화면 좌표를 레이캐스트해 모델과 만나는 지점으로 타겟을 다시 옮긴다.
      const visibleWidth = size.width - DETAIL_PANEL_WIDTH_PX;
      const ndcX = ((visibleWidth / 2) / size.width) * 2 - 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, 0), camera);
      const hit = raycaster.intersectObject(scene, true)[0];
      if (hit) {
        controls.target.copy(hit.point);
        controls.update();
      }
    }
    updateScaleBar();
    // box/rotationCenter는 모델 로드 후 1회 계산되는 고정값 — 처음 프레이밍할 때만 적용한다.
    // size는 일부러 deps에서 뺐다 — 넣으면 창 크기 바뀔 때마다 사용자가 돌려둔 각도까지
    // 초기화돼버린다.
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
