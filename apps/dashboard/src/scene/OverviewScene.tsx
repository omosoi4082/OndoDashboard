// 메인 3D 돈사(01-functional-spec.md 2장 #4) — 자돈·육성·비육 3방이 통합된 실측 모델
// (weaner_room_test.glb, 머티리얼은 glb 그대로)을 로드해 보여준다. 모델 로드·정렬·방 노드 태깅은
// scene/barnModel.ts(technical-review/pig-farm-cfd-demo/src/barnFactory.js 포팅,
// docs/07-starter-kit-assets.md)에 둔 순수 함수를 쓴다. 정보 판넬(5-1~5-3)은 호버한 방에만
// 표시(01-functional-spec.md 2장, 05-open-questions.md #29 — 2026-10-09 호버 전용으로 확정). 클릭은
// 자돈방(NH)만 반응한다(회색 방은 클릭 핸들러 자체를 달지 않는다 — 05-open-questions.md #22).
import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { RoomId } from '@ondo/shared';
import {
  BARN_NODE_CONFIG,
  computeBarnSections,
  computeRotationCenter,
  OVERVIEW_MODEL_URL,
  resolveRoomId,
  roomLabelAnchor,
  unionSectionsBox,
} from './barnModel.js';
import { CameraRig } from './CameraRig.js';
import { createWallFade, type WallFade } from './wallFade.js';
import { normalizeWallCapMaterial } from './barnMaterials.js';
import { SceneLighting } from './SceneLighting.js';
import { useMainStore } from '../store/mainStore.js';
import { okData } from '../api/client.js';
import { RoomInfoPanel, RoomNameLabel } from '../components/RoomInfoPanel.js';

// 실험군(EX) 자돈방 — 상세 패널 대상이자 메인 화면에서 유일하게 클릭 가능한 방
// (01-functional-spec.md 2장 "3D 모델링 규칙").
const PRIMARY_ROOM_ID: RoomId = 'NH';

/**
 * 카메라 회전 중심을 어디에 둘지 — 0 = **축사 모델 전체 중심**, 1 = 자돈방(EX) 중심,
 * 사이 값은 그 둘을 섞는다(scene/barnModel.ts computeRotationCenter의 lerp 가중치).
 *
 * 2026-10-28 사용자 "메인 모델 축을 자돈 말고 모델 중심으로 변경해 줘" → **0**.
 * 전에는 1이었다(2026-10-10 사용자 요청 — 전체화면 캔버스에서 고정 중심 회전이 불편하다는
 * 피드백의 1차 완화책). 되돌리려면 이 값만 1로 바꾸면 된다.
 *
 * 주의: 회전 중심을 옮기면 모델이 화면에서 차지하는 자리도 같이 움직인다 — OrbitControls는
 * 이 점을 "보이는 영역의 정중앙"에 투영하기 때문이다(CameraRig.tsx setViewOffset 주석).
 * 자돈방은 축사 한쪽 끝에 있어서, 0으로 두면 모델이 통째로 그 반대쪽으로 밀린다.
 * 잘려 보이면 OVERVIEW_CAMERA_MARGIN_FACTOR·OVERVIEW_VIEW_SHIFT_PX를 같이 조정한다.
 * (드래그 지점으로 pivot을 옮기는 방식은 과거 폐기 이력이 있어 재시도하지 않는다 —
 * CameraRig.tsx 상단 주석 참고.)
 */
const ROTATION_CENTER_WEIGHT = 0;

export function OverviewScene(): ReactElement {
  const { scene } = useGLTF(OVERVIEW_MODEL_URL);

  const selectedRoomId = useMainStore((s) => s.selectedRoomId);
  const setSelectedRoomId = useMainStore((s) => s.setSelectedRoomId);
  const hoveredRoomId = useMainStore((s) => s.hoveredRoomId);
  const setHoveredRoomId = useMainStore((s) => s.setHoveredRoomId);
  const rooms = useMainStore((s) => s.rooms);
  const roomsData = okData(rooms);

  // scene은 useGLTF 캐시로 로드마다 같은 인스턴스를 반환하므로(drei), 정렬·태깅은
  // scene 참조가 바뀌지 않는 한 한 번만 계산된다(groundAndCenterModel은 멱등 처리됨).
  // 육성·비육방 돼지는 2026-10-17 교체본(weaner_barn.glb)에 `Pigs_Grower`·`Pigs_Finisher`로
  // 들어 있다 — scene/roomPigs.ts의 buildRoomPigs()를 부르면 돼지가 두 벌이 되므로
  // **되살리지 않는다**(05-open-questions.md #48 해소).
  const sections = useMemo(() => {
    computeShadowFlags(scene);
    // 벽 위 테두리를 한 가지 회색으로(2026-10-17 사용자 요청) — scene/barnMaterials.ts.
    normalizeWallCapMaterial(scene);
    return computeBarnSections(scene, BARN_NODE_CONFIG);
  }, [scene]);

  // 앞벽 페이드(scene/wallFade.ts) — 카메라와 실내 사이를 가로막는 외벽만 매 프레임 투명해진다.
  // 머티리얼을 복제해 벽마다 따로 투명도를 주므로, 정리할 때 반드시 dispose로 원복한다
  // (useGLTF 캐시는 같은 scene 인스턴스를 공유해서, 안 되돌리면 복제본이 쌓인다).
  //
  // ★ 생성과 정리를 **같은 effect 안에** 둔다. useMemo로 만들고 effect에서 정리하면
  //   StrictMode(개발 모드의 마운트→언마운트→재마운트)에서 페이드가 조용히 죽는다:
  //   언마운트 때 dispose()가 walls 배열을 비우는데, 재마운트 때 useMemo는 deps가 같아
  //   **다시 계산하지 않고 비워진 객체를 그대로 재사용**하므로 update()가 아무 일도 하지
  //   않는다. 오류도 안 나서 "페이드가 안 걸린다"로만 보인다(2026-10-17 실제로 겪음).
  const wallFadeRef = useRef<WallFade | null>(null);
  useEffect(() => {
    const fade = createWallFade(scene);
    wallFadeRef.current = fade;
    return () => {
      fade.dispose();
      wallFadeRef.current = null;
    };
  }, [scene]);
  // 카메라를 움직인 뒤·렌더 직전에 불러야 한다. useFrame 기본 우선순위면 렌더 전에 돈다.
  useFrame(({ camera }) => wallFadeRef.current?.update(camera));

  const frameBox = useMemo(() => unionSectionsBox(sections), [sections]);
  const rotationCenter = useMemo(
    () =>
      frameBox
        ? computeRotationCenter(sections, frameBox, PRIMARY_ROOM_ID, ROTATION_CENTER_WEIGHT)
        : null,
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

      <group
        onPointerOver={handlePointerOver}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <primitive object={scene} />
      </group>

      {/* 방 이름표와 정보 판넬(5-1~5-3) — 둘 다 **원형 환기구(배기구)가 있는 벽 쪽, 천정
          높이, 길이 방향 가운데**에 같은 앵커로 띄운다. 2026-10-14 사용자 요청 순서대로
          "이름표를 방 중간에" → "가운데가 천정에서 가운데, 방 안이 아니고" → "원형 환기구
          있는 벽으로 위치이동하고 높이, 가운데는 그대로". 높이(박스 윗면)와 길이 방향(z)
          가운데는 그대로 두고 폭 방향(x)만 그 벽으로 옮긴다.
          앵커 좌표는 barnModel.ts의 roomLabelAnchor가 **벽 노드**에서 직접 잡는다 — 방
          바운딩박스를 쓰면 지붕 처마·천정 급기팬까지 포함돼 벽에서 뜨고 높이 뜬다
          (2026-10-14 "조금 내려서 벽쪽에 가까이 해줘"). 평소에는 이름표, 호버한 방만 정보
          판넬로 바뀐다(3개 방 모두 호버 시 표시 — 05-open-questions.md #29·#35). 모델에
          가리지 않게 drei <Html>의 기본(occlude 없음)을 그대로 쓴다. */}
      {sections.map((section) => {
        const summary = roomsData?.[section.roomId] ?? null;
        const anchor = roomLabelAnchor(scene, section);
        return (
          <Html
            key={section.roomId}
            position={[anchor.x, anchor.y, anchor.z]}
            style={{ pointerEvents: 'none' }}
          >
            {section.roomId === hoveredRoomId ? (
              <RoomInfoPanel roomId={section.roomId} summary={summary} />
            ) : (
              <RoomNameLabel roomId={section.roomId} name={summary?.name ?? section.roomId} />
            )}
          </Html>
        );
      })}
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
