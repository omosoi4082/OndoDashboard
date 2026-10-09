// 메인 3D 돈사(01-functional-spec.md 2장 #4) — Canvas 렌더러 설정은
// technical-review/pig-farm-cfd-demo/src/overviewScene.js에서 포팅
// (logarithmicDepthBuffer:true 등, docs/07-starter-kit-assets.md). 자돈·육성·비육 3방이
// 통합된 실측 모델(weaner_room_test-001.glb) 로드·상호작용은 OverviewScene.tsx가 맡는다.
// 그림자를 지는 방향광은 여기 고정 위치로 두지 않는다 — 모델 로드 전에는 실제 크기를
// 몰라 그림자 카메라 프러스텀을 맞출 수 없기 때문에, 로드된 sections 박스를 아는
// OverviewScene.tsx 쪽(scene/SceneLighting.tsx)에서 매번 다시 계산해 배치한다
// (2026-10-09, 돼지 그림자가 전혀 안 지던 문제 수정 — 고정 위치였을 때는 그림자 카메라가
// 기본값(-5~5)에 머물러 있어 긴 통합 모델 범위를 못 덮었다).
import { Suspense, type ReactElement } from 'react';
import { Canvas } from '@react-three/fiber';
import { OverviewScene } from './OverviewScene.js';
import { useMainStore } from '../store/mainStore.js';

export function MainScene(): ReactElement {
  const setHoveredRoomId = useMainStore((s) => s.setHoveredRoomId);

  return (
    <Canvas
      shadows
      gl={{ antialias: true, logarithmicDepthBuffer: true }}
      camera={{ fov: 45, near: 0.1, far: 300 }}
      onPointerMissed={() => setHoveredRoomId(null)}
    >
      <color attach="background" args={['#eef2f6']} />
      <hemisphereLight args={['#ffffff', '#d9dfe6', 0.55]} />
      <ambientLight intensity={0.18} />
      <directionalLight position={[-8, 6, -6]} intensity={0.12} />

      <Suspense fallback={null}>
        <OverviewScene />
      </Suspense>
    </Canvas>
  );
}
