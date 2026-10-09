// 메인 3D 돈사(01-functional-spec.md 2장 #4) — 자돈·육성·비육 3방이 통합된 실측 모델
// (weaner_room_test-001.glb)을 로드해 보여준다. 모델 로드·정렬·방 노드 태깅은
// scene/barnModel.ts(technical-review/pig-farm-cfd-demo/src/barnFactory.js 포팅,
// docs/07-starter-kit-assets.md)에 둔 순수 함수를 쓴다. 정보 판넬(5-1~5-3)은 3개 방 모두
// 상시 표시(2026-10-09, 호버 전용 여부는 추후 결정 — 05-open-questions.md #29). 클릭은
// 자돈방(NH)만 반응한다(회색 방은 클릭 핸들러 자체를 달지 않는다 — 05-open-questions.md #22).
import { useMemo, type ReactElement } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { RoomId } from '@ondo/shared';
import {
  BARN_NODE_CONFIG,
  computeBarnSections,
  computeRotationCenter,
  OVERVIEW_MODEL_URL,
  resolveRoomId,
  unionSectionsBox,
} from './barnModel.js';
import { CameraRig } from './CameraRig.js';
import { SceneLighting } from './SceneLighting.js';
import { ROOM_CALLOUT_OFFSET_M } from '../config/constants.js';
import { useMainStore } from '../store/mainStore.js';
import { okData } from '../api/client.js';
import { RoomInfoPanel } from '../components/RoomInfoPanel.js';

// 실험군(EX) 자돈방 — 상세 패널 대상이자 메인 화면에서 유일하게 클릭 가능한 방
// (01-functional-spec.md 2장 "3D 모델링 규칙"). 카메라 회전 중심을 이 방 쪽으로
// 치우치게 두는 기준이기도 하다(overviewScene.js, 2026-10-09).
const PRIMARY_ROOM_ID: RoomId = 'NH';
const ROTATION_CENTER_WEIGHT = 0.5;

export function OverviewScene(): ReactElement {
  const { scene } = useGLTF(OVERVIEW_MODEL_URL);

  const selectedRoomId = useMainStore((s) => s.selectedRoomId);
  const setSelectedRoomId = useMainStore((s) => s.setSelectedRoomId);
  const setHoveredRoomId = useMainStore((s) => s.setHoveredRoomId);
  const rooms = useMainStore((s) => s.rooms);
  const roomsData = okData(rooms);

  // scene은 useGLTF 캐시로 로드마다 같은 인스턴스를 반환하므로(drei), 정렬·태깅은
  // scene 참조가 바뀌지 않는 한 한 번만 계산된다(groundAndCenterModel은 멱등 처리됨).
  const sections = useMemo(() => {
    computeShadowFlags(scene);
    return computeBarnSections(scene, BARN_NODE_CONFIG);
  }, [scene]);

  const frameBox = useMemo(() => unionSectionsBox(sections), [sections]);
  const rotationCenter = useMemo(
    () => (frameBox ? computeRotationCenter(sections, frameBox, PRIMARY_ROOM_ID, ROTATION_CENTER_WEIGHT) : null),
    [sections, frameBox],
  );

  const handlePointerOver = (e: ThreeEvent<PointerEvent>): void => {
    e.stopPropagation();
    const roomId = resolveRoomId(e.object);
    setHoveredRoomId(roomId);
    document.body.style.cursor = roomId === PRIMARY_ROOM_ID ? 'pointer' : 'default';
  };
  const handlePointerMove = handlePointerOver;
  const handlePointerOut = (e: ThreeEvent<PointerEvent>): void => {
    e.stopPropagation();
    setHoveredRoomId(null);
    document.body.style.cursor = 'default';
  };
  const handleClick = (e: ThreeEvent<MouseEvent>): void => {
    const roomId = resolveRoomId(e.object);
    if (roomId !== PRIMARY_ROOM_ID) return; // 육성·비육은 클릭 핸들러를 달지 않는다(회색 = 선택 불가).
    e.stopPropagation();
    setSelectedRoomId(selectedRoomId === roomId ? null : roomId);
  };

  return (
    <>
      {frameBox && <CameraRig box={frameBox} rotationCenter={rotationCenter ?? undefined} />}
      {frameBox && <SceneLighting box={frameBox} />}

      <group onPointerOver={handlePointerOver} onPointerMove={handlePointerMove} onPointerOut={handlePointerOut} onClick={handleClick}>
        <primitive object={scene} />
      </group>

      {/* 정보 판넬(5-1~5-3) — 방 바로 위에 뜨는 콜아웃(docs/design/screen-design.png on-01
          ④⑤). 2026-10-09 사용자 요청: 호버 여부와 무관하게 3개 방 모두 상시 표시로 단순화
          (호버 전용 vs 상시 노출은 추후 결정 — 05-open-questions.md #29). 호버 상태(hoveredRoomId)
          자체는 커서 전환용으로 계속 추적하므로, 나중에 호버 전용으로 되돌리려면 이 블록만
          `sections.filter(s => s.roomId === hoveredRoomId)`로 바꾸면 된다. */}
      {sections.map((section) => (
        <Html
          key={section.roomId}
          position={[section.center.x, section.center.y + section.size.y / 2 + ROOM_CALLOUT_OFFSET_M, section.center.z]}
          style={{ pointerEvents: 'none' }}
        >
          <RoomInfoPanel roomId={section.roomId} summary={roomsData?.[section.roomId] ?? null} />
        </Html>
      ))}
    </>
  );
}

// overviewScene.js가 모델 로드 후 모든 메쉬에 그림자 송수신을 켜는 부분 포팅 — 메인 화면
// 조명 리그(MainScene.tsx의 directionalLight castShadow)가 제대로 보이게 한다.
function computeShadowFlags(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.receiveShadow = true;
    obj.castShadow = true;
  });
}
