// 상세 자돈방 3D 뷰(12·18·25·32) — 카메라 리그(OrbitControls + 초기 프레이밍)는
// scene/cameraFraming.ts(technical-review/pig-farm-cfd-demo의 overviewScene.js에서 이미
// 포팅해 둔 순수 함수, docs/07-starter-kit-assets.md)를 그대로 재사용한다. 배경 모델은
// detailScene.js를 포팅한 scene/detailRoomModel.ts(돼지 있는 실측 자돈방 p1.glb + 컷어웨이
// 셰이더)를 쓴다. 125개 포인트는 PointsInstanced(InstancedMesh 1개), 유동 토글 선택 시
// 호버 포인트에 FlowArrow를 띄운다. frame이 null이면(데이터 전·로딩·오류) 방 모델과 중립색
// 포인트만 그리고 message를 3D 위에 겹쳐 띄운다(01-functional-spec.md 3장 "데이터가 없을 때").
import { Suspense, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { DetailBase, DetailFrame, Geometry } from '@ondo/shared';
import { zUpToYUp } from '../../scene/coords.js';
import { computeCameraFrame } from '../../scene/cameraFraming.js';
import { CAMERA_MARGIN_FACTOR } from '../../config/constants.js';
import { useDetailStore } from '../../store/detailStore.js';
import { getFieldUnit, getPointFlow, getPointScalar } from '../../detail/pointSelection.js';
import { formatValueOrDash } from '../../utils/formatValue.js';
import { DETAIL_MODEL_URL, getOrPrepareDetailRoomModel } from '../../scene/detailRoomModel.js';
import { PointsInstanced } from './PointsInstanced.js';
import { FlowArrow } from './FlowArrow.js';
import { Detail3DSection } from './DetailSections.js';

interface Detail3DViewProps {
  geometry: Geometry;
  frame: DetailFrame | null;
  range: DetailBase['range'] | null;
  /**
   * 예측·전문가·제어 모드 전용 추가 표현(IsosurfaceVolume 또는 FlowCylinders) — 카메라·
   * 조명·방 모델·125개 포인트·호버는 이 컴포넌트가 그대로 맡고, 모드별로 다른 내용만
   * 이 슬롯으로 끼워 넣는다(중복 구현 금지, docs/04-tasks.md M5). 현재 모드는 넘기지
   * 않는다(01-functional-spec.md 3장 "현재 모드: 125개 포인트만"). <Canvas> 안(R3F 트리)에
   * 렌더링되므로 Three.js 객체만 들어간다.
   */
  overlay?: ReactNode;
  /**
   * 제어 모드(34) 환기량 비교 그래프 카드처럼 3D 영역 위에 얹는 평면 HTML 오버레이
   * (01-functional-spec.md 4.4 "32번 3D 영역 오버레이, C안") — overlay와 달리 <Canvas>
   * 바깥(DOM)에 절대 위치로 그린다. M5의 overlay 슬롯과 같은 목적(모드별 추가 표현을
   * 이 컴포넌트 수정 없이 끼워 넣기)을 HTML 콘텐츠로 확장한 것이라 이름을 구분했다.
   */
  htmlOverlay?: ReactNode;
  /** 데이터 없음 안내·로딩·오류 문구 — 3D 뷰 가운데에 겹쳐 표시한다. */
  message?: { text: string; isError: boolean } | null;
}

function CameraFraming({ roomSize }: { roomSize: readonly [number, number, number] }): ReactElement {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    const [w, h, d] = zUpToYUp(roomSize);
    const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(w, h, d));
    const frame = computeCameraFrame(box, CAMERA_MARGIN_FACTOR);

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
    // roomSize는 geometry 기준 고정값 — 마운트 시 1회만 프레이밍한다(MainScene의
    // CameraRig.tsx와 같은 패턴).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  return <OrbitControls ref={controlsRef} enableDamping zoomToCursor makeDefault />;
}

// detailScene.js의 PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04) 포팅 —
// 금속/플라스틱 재질에 은은한 반사광을 준다. Canvas가 관리하는 렌더러(gl)를 useThree로
// 받아와 scene.environment에 꽂는다.
function DetailRoomEnvironment(): null {
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const renderTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    // detailScene.js의 scene.environment 대입과 동일 — R3F Canvas가 만든 scene에 PMREM
    // 반사광 텍스처를 꽂는 것 자체가 목적이라 이 대입은 의도된 동작이다.
    // oxlint-disable-next-line react/immutability
    scene.environment = renderTarget.texture;
    return () => {
      // oxlint-disable-next-line react/immutability
      scene.environment = null;
      renderTarget.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  return null;
}

// detailScene.js의 조명 리그(HemisphereLight+AmbientLight+방 크기에 맞춘 그림자 카메라를
// 가진 DirectionalLight+보조 DirectionalLight+PointLight) 포팅 — target이 있는
// DirectionalLight와 shadow.camera 세부 설정은 JSX로 선언하기 어려워 효과(effect) 안에서
// demo와 동일하게 구성한다.
function DetailRoomLighting({ roomSize }: { roomSize: readonly [number, number, number] }): null {
  const { scene } = useThree();

  useEffect(() => {
    const [w, h, d] = roomSize;
    const group = new THREE.Group();

    group.add(new THREE.HemisphereLight(0xffffff, 0xd9dfe6, 0.55));
    group.add(new THREE.AmbientLight(0xffffff, 0.18));

    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(w / 2 + 2, h + 3, d / 2 + 1.5);
    dir.target.position.set(w / 2, 0, d / 2);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.bias = -0.0015;
    const half = Math.max(w, d) * 0.75;
    dir.shadow.camera.left = -half;
    dir.shadow.camera.right = half;
    dir.shadow.camera.top = half;
    dir.shadow.camera.bottom = -half;
    dir.shadow.camera.near = 0.1;
    dir.shadow.camera.far = w + h + d + 5;
    dir.shadow.camera.updateProjectionMatrix();
    group.add(dir, dir.target);

    const fill = new THREE.DirectionalLight(0xffffff, 0.12);
    fill.position.set(-6, 4, -5);
    group.add(fill);

    // 실내등(포인트 라이트)은 그림자 없이 은은한 채움광으로만 — 천장 근처에서 역제곱
    // 법칙으로 한 지점만 하얗게 뜨는 문제가 있어 세기를 낮추고 천장에서 띄운다.
    const roomLight = new THREE.PointLight(0xfff2e0, 0.8, 0, 2);
    roomLight.position.set(w / 2, h - 0.7, d / 2);
    group.add(roomLight);

    scene.add(group);
    return () => {
      scene.remove(group);
    };
  }, [scene, roomSize]);

  return null;
}

// detailScene.js ensureRealModel() 포팅 — 돼지 있는 실측 자돈방(p1.glb)을 geometry.room.size
// 기준으로 스케일·배치하고 컷어웨이 셰이더를 적용한다(scene/detailRoomModel.ts).
function DetailRoomModel({ roomSizeYUp }: { roomSizeYUp: readonly [number, number, number] }): ReactElement {
  const { scene: gltfScene } = useGLTF(DETAIL_MODEL_URL);
  const model = useMemo(() => getOrPrepareDetailRoomModel(gltfScene, roomSizeYUp), [gltfScene, roomSizeYUp]);
  return <primitive object={model} />;
}

export function Detail3DView({
  geometry,
  frame,
  range,
  overlay = null,
  htmlOverlay = null,
  message = null,
}: Detail3DViewProps): ReactElement {
  const valueField = useDetailStore((s) => s.valueField);
  const pointsVisible = useDetailStore((s) => s.pointsVisible);
  const [hoveredPointId, setHoveredPointId] = useState<number | null>(null);

  const hoveredPoint = hoveredPointId !== null ? geometry.points.find((p) => p.id === hoveredPointId) ?? null : null;
  const hoveredFlow = hoveredPoint && frame ? getPointFlow(frame, hoveredPoint.id) : null;

  // geometry는 상세 진입 시 1회만 받아오는 고정값(store에 보관)이라 참조가 안정적이다 —
  // useMemo로 묶어서 매 렌더마다 조명/모델 effect가 불필요하게 재생성되지 않게 한다.
  const roomSizeYUp = useMemo(() => zUpToYUp(geometry.room.size), [geometry.room.size]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-ondo-border bg-ondo-surface">
      <Canvas shadows="soft" gl={{ antialias: true, logarithmicDepthBuffer: true }} camera={{ fov: 45, near: 0.1, far: 100 }}>
        <color attach="background" args={['#232328']} />

        <CameraFraming roomSize={geometry.room.size} />
        <DetailRoomEnvironment />
        <DetailRoomLighting roomSize={roomSizeYUp} />

        {/* 돼지 있는 실측 자돈방 모델(p1.glb) — detailScene.js ensureRealModel() 포팅
            (scene/detailRoomModel.ts). 125개 포인트는 이 모델과 같은 geometry.room.size
            기준 박스 위에 겹쳐 그려진다(coords.ts 변환 공유). */}
        <Suspense fallback={null}>
          <DetailRoomModel roomSizeYUp={roomSizeYUp} />
        </Suspense>

        {pointsVisible && (
          <PointsInstanced
            geometry={geometry}
            frame={frame}
            range={range}
            valueField={valueField}
            onHoverChange={setHoveredPointId}
          />
        )}

        {overlay}

        {valueField === 'flow' && hoveredPoint && hoveredFlow && range && (
          <FlowArrow origin={hoveredPoint} flow={hoveredFlow} range={range.flow} />
        )}

        {hoveredPoint && (
          <Html position={zUpToYUp([hoveredPoint.x, hoveredPoint.y, hoveredPoint.z])} style={{ pointerEvents: 'none' }}>
            <div className="-translate-y-full whitespace-nowrap rounded bg-black/85 px-2 py-1 text-[11px] text-white">
              X {hoveredPoint.x.toFixed(2)} &nbsp; Y {hoveredPoint.y.toFixed(2)} &nbsp; Z {hoveredPoint.z.toFixed(2)}
              <br />
              VALUE{' '}
              {frame
                ? formatValueOrDash(
                    getPointScalar(frame, valueField, hoveredPoint.id),
                    getFieldUnit(valueField),
                    valueField === 'flow' ? 2 : 1,
                  )
                : '-'}
            </div>
          </Html>
        )}
      </Canvas>

      {/* 제어 모드 요약 카드 위치 — 우측 하단(2026-10-11 04_제어모드_디자인_01_gh 전달,
          이전엔 좌측 상단이었다). */}
      {htmlOverlay && <div className="pointer-events-none absolute bottom-3 right-3">{htmlOverlay}</div>}

      {message && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
          <div
            className={`rounded-md border px-4 py-2 text-center text-sm backdrop-blur-sm ${
              message.isError ? 'border-red-500/30 bg-red-950/60 text-red-300' : 'border-white/10 bg-black/50 text-white/70'
            }`}
          >
            {message.text}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 데이터 없음·로딩·오류 상태의 3D 영역 — 방 모델과 중립색 포인트를 그대로 그리고 문구만
 * 겹쳐 띄운다(01-functional-spec.md 3장 "데이터가 없을 때"). 높이는 데이터가 있을 때의
 * 3D 영역과 같게 맞춰 상태가 바뀌어도 레이아웃이 튀지 않게 한다.
 */
export function EmptyDetail3D({ geometry, text, isError }: { geometry: Geometry; text: string; isError: boolean }): ReactElement {
  return (
    <Detail3DSection>
      <Detail3DView geometry={geometry} frame={null} range={null} message={{ text, isError }} />
    </Detail3DSection>
  );
}
