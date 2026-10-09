// 메인 화면 그림자 조명 리그 — technical-review/pig-farm-cfd-demo/src/overviewScene.js의
// "모델 로드 완료 후 실제 크기에 맞춰 방향광·그림자 카메라를 재배치" 로직 포팅
// (docs/07-starter-kit-assets.md). MainScene.tsx의 고정 위치 directionalLight는 모델
// 교체(weaner_room_test-001.glb, 3방 통합이라 한쪽으로 길게 뻗음) 후에도 그대로 남아있어서
// 그림자 카메라 프러스텀이 기본값(-5~5)에 머물렀고, 그 범위 밖인 자돈방 돼지에는 그림자가
// 전혀 지지 않았다(2026-10-09 사용자 신고). box(자돈·육성·비육 sections 합집합)로 매 로드마다
// 다시 계산한다.
import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import * as THREE from 'three';

interface SceneLightingProps {
  box: THREE.Box3;
}

export function SceneLighting({ box }: SceneLightingProps): ReactElement {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);

  const { lightPosition, targetPosition, shadowHalf, shadowFar } = useMemo(() => {
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    return {
      lightPosition: new THREE.Vector3(
        center.x + size.x * 0.4,
        box.max.y + size.y * 1.5,
        center.z + size.z * 0.3,
      ),
      targetPosition: center,
      shadowHalf: Math.max(size.x, size.z) * 0.75,
      shadowFar: size.length() + 5,
    };
  }, [box]);

  useEffect(() => {
    const light = lightRef.current;
    const target = targetRef.current;
    if (!light || !target) return;
    light.target = target;
  }, []);

  return (
    <>
      <directionalLight
        ref={lightRef}
        position={lightPosition}
        intensity={1.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0015}
        shadow-camera-left={-shadowHalf}
        shadow-camera-right={shadowHalf}
        shadow-camera-top={shadowHalf}
        shadow-camera-bottom={-shadowHalf}
        shadow-camera-near={0.1}
        shadow-camera-far={shadowFar}
      />
      <object3D ref={targetRef} position={targetPosition} />
    </>
  );
}
