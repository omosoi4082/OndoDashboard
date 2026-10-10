// technical-review/pig-farm-cfd-demo/src/overviewScene.js의 카메라 리그를 포팅
// (docs/07-starter-kit-assets.md) — OrbitControls 생성·zoomToCursor=true, 모델
// bounding box에 맞춘 초기 카메라 프레이밍(frameCameraToBox → computeCameraFrame).
// 주의: "드래그할 때마다 클릭/드래그 지점으로 pivot을 옮기는" 기능은 데모에서 화면이
// 튀는("뜅기는") 문제로 최종 폐기된 것이라 가져오지 않는다 — 절대 다시 넣지 말 것
// (시도했다 되돌린 이력: 9ba9c1b → 402d82f).
import { useEffect, useRef, type ReactElement } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { computeCameraFrame } from './cameraFraming.js';
import { metersPerPixel, pickScaleBar } from './scaleBar.js';
import {
  DETAIL_PANEL_WIDTH_PX,
  OVERVIEW_CAMERA_DIRECTION,
  OVERVIEW_CAMERA_MARGIN_FACTOR,
  SCALE_BAR_TARGET_PX,
} from '../config/constants.js';
import { useMainStore } from '../store/mainStore.js';

interface CameraRigProps {
  /** 프레이밍 기준 박스 — 로드된 glb의 sections(자돈·육성·비육) 합집합(scene/barnModel.ts). */
  box: THREE.Box3;
  /** 회전 중심 — box 중심 대신 이 지점으로 둔다(자돈방 쪽으로 치우친 지점, 선택값). */
  rotationCenter?: THREE.Vector3;
}

export function CameraRig({ box, rotationCenter }: CameraRigProps): ReactElement {
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const setScaleBar = useMainStore((s) => s.setScaleBar);

  useEffect(() => {
    const frame = computeCameraFrame(box, OVERVIEW_CAMERA_MARGIN_FACTOR, rotationCenter, OVERVIEW_CAMERA_DIRECTION);

    camera.position.copy(frame.position);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.near = frame.near;
      camera.far = frame.far;

      // 2026-10-10: OrbitControls는 target으로 잡은 점을 무조건 "캔버스 정중앙"에 투영한다
      // (target을 뭘로 바꾸든 그 자체가 다시 화면 정중앙으로 끌려감 — 레이캐스트로 피벗
      // 월드좌표를 구해 target에 넣는 방식으로는 절대 해결 못 함, 실제로 해봤다가 안 됐음).
      // "캔버스 정중앙"이 아니라 "상세 패널에 안 가려지는 보이는 영역 중앙"을 투영 중심으로
      // 쓰려면 투영 자체를 비대칭으로 틀어야 한다 — setViewOffset으로, 캔버스보다
      // DETAIL_PANEL_WIDTH_PX만큼 더 넓은 가상 프레임의 "오른쪽" 구간을 찍는 척한다. 그러면
      // 가상 프레임의 광학 중심(fullWidth/2)이 실제 캔버스 안에서는
      // fullWidth/2 - offsetX = (W+P)/2 - P = (W-P)/2 지점, 즉 보이는 영역(W−P)의 정중앙에
      // 오게 된다. 프레이밍 시 한 번만 설정하고 드래그 중엔 안 건드리므로 과거 "뜅김"
      // 문제와도 무관하다.
      //
      // 주의(2026-10-10 수정): aspect를 "실제 캔버스 비율"(w/h)로 두면 setViewOffset이 가로
      // 폭만 w/fullWidth 비율로 한 번 더 줄여버려서 모델이 가로로 찌그러진다 — aspect는
      // "가상의 더 넓은 프레임 비율"(fullWidth/h)로 둬야 찌그러짐 없이 정확히 크롭된다.
      // MainScene의 Canvas camera에 manual:true를 줘서 R3F가 리사이즈마다 aspect를
      // 실제 캔버스 비율로 자동으로 되돌리지 못하게 했다 — 안 그러면 다음 프레임에 다시 깨짐.
      const w = size.width;
      const h = size.height;
      const p = DETAIL_PANEL_WIDTH_PX;
      const fullWidth = w + p;
      camera.aspect = fullWidth / h;
      camera.setViewOffset(fullWidth, h, p, 0, w, h);
      camera.updateProjectionMatrix();
    }
    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(frame.target);
      controls.update();
    }
    updateScaleBar();
    // box/rotationCenter는 모델 로드 후 1회 계산되는 고정값 — 처음 프레이밍할 때만 적용한다.
    // size는 일부러 deps에서 뺐다 — 넣으면 창 크기 바뀔 때마다 사용자가 돌려둔 각도까지
    // 초기화돼버린다(같은 이유로 setViewOffset도 마운트 시점 크기 기준 — 창 리사이즈 후
    // 다시 들어와야 반영됨).
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
