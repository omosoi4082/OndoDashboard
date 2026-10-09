// 상세 패널(12·18·25·32) 배경 모델 — technical-review/pig-farm-cfd-demo/src/detailScene.js의
// ensureRealModel()/applyCameraCutaway()(barnFactory.js) 포팅(docs/07-starter-kit-assets.md).
// 물리/스케일 계산 로직은 그대로 두고, 데모의 하드코딩 ROOM 상수 대신 이 프로젝트의
// geometry.room.size(GET /api/detail/geometry, PINN v17.0 실측값)를 목표 치수로 받는다.
//
// p1.glb 실제 노드/머티리얼 이름(2026-10-09, glb 바이너리 직접 파싱해 확인 — detailScene.js
// 주석에 적힌 이름과 전부 일치했다): PigRoom_Walls_Solid / PigRoom_RoofPanel_Solid(두꺼운
// 벽·천장, 상세에서는 숨김) / PigRoom_FloorSlab / PigRoom_Walls_Flat(스케일 기준 "방 껍질")
// / 루트 노드 "P1" / 컷어웨이 대상 머티리얼 "Plastic010"(Walls_Flat·Roof_Flat가 공유).
import * as THREE from 'three';
import { sanitizeNodeName } from './barnModel.js';

// Vite가 /assets/models/p1.glb로 정적 서빙(apps/dashboard/public/assets/models/p1.glb).
export const DETAIL_MODEL_URL = '/assets/models/p1.glb';

export const DETAIL_ROOM_NODE_NAMES = {
  root: 'P1',
  solidWalls: 'PigRoom_Walls_Solid',
  solidRoof: 'PigRoom_RoofPanel_Solid',
  floor: 'PigRoom_FloorSlab',
  flatWalls: 'PigRoom_Walls_Flat',
} as const;

// 카메라를 향한 면(앞면)은 뚫어서 안 보이게 하고 반대쪽은 그대로 보이게 하는 "컷어웨이"
// 재질 — barnFactory.js의 applyCameraCutaway를 그대로 포팅(메인 화면은 통짜 모델이라
// 안 쓰지만 상세 패널은 이 셰이더가 필요하다).
const CUTAWAY_MATERIAL_PREFIXES = ['Plastic010'] as const;

function isCutawayMaterial(material: THREE.Material): boolean {
  return CUTAWAY_MATERIAL_PREFIXES.some((prefix) => material.name.startsWith(prefix));
}

export function applyCameraCutaway(root: THREE.Object3D): void {
  const patched = new Set<string>();
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of materials) {
      if (!mat || patched.has(mat.uuid) || !isCutawayMaterial(mat)) continue;
      patched.add(mat.uuid);
      mat.side = THREE.DoubleSide;
      // discard로 반쪽을 지우는 방식이라 실제로는 완전 불투명 렌더 — 블렌딩/정렬에 맡기지
      // 않도록 명시적으로 opaque 렌더 경로를 강제한다(barnFactory.js 주석과 동일 이유).
      mat.transparent = false;
      mat.alphaTest = 0;
      mat.depthWrite = true;
      mat.depthTest = true;
      mat.shadowSide = THREE.BackSide; // 그림자는 진짜(반대쪽) 면 기준으로
      const previousOnBeforeCompile = mat.onBeforeCompile;
      mat.onBeforeCompile = function cutawayOnBeforeCompile(
        shader: THREE.WebGLProgramParametersWithUniforms,
        renderer: THREE.WebGLRenderer,
      ) {
        previousOnBeforeCompile?.call(this, shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
          if (gl_FrontFacing) discard;`,
        );
      };
      mat.needsUpdate = true;
    }
  });
}

/**
 * 상세보기는 두께 없는 판 벽/천장만 쓴다(컷어웨이 셰이더가 두꺼운 벽에서는 안쪽 면이
 * 겹쳐 이상해지므로) — 두꺼운(메인 화면용) 버전은 숨긴다. ★ 바운딩 박스를 재기 "전에"
 * 호출해야 한다 — 안 그러면 두꺼운 벽까지 포함한 크기로 스케일이 계산돼 판 벽 쪽이
 * 박스보다 작아지고 포인트/기류가 방 밖으로 새어 보인다(detailScene.js 주석).
 */
export function hideSolidShellNodes(model: THREE.Object3D): void {
  for (const name of [DETAIL_ROOM_NODE_NAMES.solidWalls, DETAIL_ROOM_NODE_NAMES.solidRoof]) {
    const node = model.getObjectByName(name);
    if (node) node.visible = false;
  }
}

/**
 * 스케일 기준 박스 — 방 "껍질"(바닥+벽)만 잰다. 지붕/팬 하우징처럼 방 바깥으로 튀어나온
 * 부분까지 포함하면 방 높이가 실제보다 크게 측정돼 벽 윗부분이 짧아지고 천장과 틈이
 * 벌어진다. hideSolidShellNodes()를 먼저 호출한 뒤 써야 한다.
 */
export function computeShellBox(model: THREE.Object3D): THREE.Box3 {
  model.updateMatrixWorld(true);
  const shellBox = new THREE.Box3();
  const floorNode = model.getObjectByName(DETAIL_ROOM_NODE_NAMES.floor);
  const wallNode = model.getObjectByName(DETAIL_ROOM_NODE_NAMES.flatWalls);
  if (floorNode) shellBox.expandByObject(floorNode);
  if (wallNode) shellBox.expandByObject(wallNode);
  return shellBox.isEmpty() ? new THREE.Box3().setFromObject(model) : shellBox;
}

export interface RoomFitTransform {
  scale: THREE.Vector3;
  position: THREE.Vector3;
}

/**
 * shellBox(모델의 현재 스케일 기준 치수)가 targetSize를 축마다 다른 비율로 정확히 채우도록
 * 스케일하고, 수평으로는 targetCenterXZ 기준 중심을 맞추고 바닥은 y=0에 붙이는 변환을
 * 계산한다(detailScene.js ensureRealModel 포팅). Three.js 좌표계(y-up) 기준 입력을 받는다.
 */
export function computeRoomFitTransform(
  shellBox: THREE.Box3,
  targetSize: THREE.Vector3,
  targetCenterXZ: { x: number; z: number },
): RoomFitTransform {
  const size = new THREE.Vector3();
  shellBox.getSize(size);
  const center = new THREE.Vector3();
  shellBox.getCenter(center);

  const scaleX = size.x !== 0 ? targetSize.x / size.x : 1;
  const scaleY = size.y !== 0 ? targetSize.y / size.y : 1;
  const scaleZ = size.z !== 0 ? targetSize.z / size.z : 1;

  const position = new THREE.Vector3(
    targetCenterXZ.x - center.x * scaleX,
    -shellBox.min.y * scaleY,
    targetCenterXZ.z - center.z * scaleZ,
  );

  return { scale: new THREE.Vector3(scaleX, scaleY, scaleZ), position };
}

/**
 * gltf.scene에서 "P1" 노드(없으면 scene 전체)를 찾아 clone한다(detailScene.js
 * ensureRealModel 포팅) — 캐시 원본(gltf.scene)은 손대지 않고 매번 새 인스턴스를 쓴다.
 */
export function cloneRoomRoot(gltfScene: THREE.Object3D): THREE.Object3D {
  const key = sanitizeNodeName(DETAIL_ROOM_NODE_NAMES.root);
  const src = gltfScene.getObjectByName(key) ?? gltfScene;
  return src.clone(true);
}

/**
 * p1.glb 클론을 targetRoomSizeYUp(Three.js y-up, m)에 맞춰 준비한다: 두꺼운 벽/천장을
 * 숨기고, 방 껍질 치수를 재서 축마다 스케일하고, 방 박스(0,0,0)~(w,h,d) 기준으로 배치한 뒤
 * 컷어웨이(카메라 쪽 벽/천장 투명화)·그림자 플래그까지 적용한 최종 모델을 반환한다.
 * scene/coords.ts의 zUpToYUp 변환을 거친 값을 넘겨야 한다(이 함수 자체는 좌표 변환을
 * 하지 않는다 — CLAUDE.md "좌표 변환은 coords.ts 한 곳에서만" 규칙).
 */
export function prepareDetailRoomModel(
  gltfScene: THREE.Object3D,
  targetRoomSizeYUp: readonly [number, number, number],
): THREE.Object3D {
  const model = cloneRoomRoot(gltfScene);
  hideSolidShellNodes(model);

  const shellBox = computeShellBox(model);
  const [w, h, d] = targetRoomSizeYUp;
  const { scale, position } = computeRoomFitTransform(shellBox, new THREE.Vector3(w, h, d), {
    x: w / 2,
    z: d / 2,
  });

  model.scale.copy(scale);
  model.position.copy(position);

  applyCameraCutaway(model);
  model.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.receiveShadow = true;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    obj.castShadow = !materials.some((m) => isCutawayMaterial(m));
  });

  return model;
}

// gltfScene(= useGLTF 캐시, 세션 내 고정) 기준으로 1회만 클론·스케일·컷어웨이를 적용한다.
// React 쪽에서 Detail3DView가 마운트/언마운트될 때마다 다시 계산하면(Plastic010 머티리얼이
// Walls_Flat/Roof_Flat에 공유돼 있어) onBeforeCompile 래핑이 계속 누적되므로, 데모의
// realModelCache Map과 같은 역할을 모듈 전역 캐시로 둔다.
const preparedModelCache = new WeakMap<THREE.Object3D, THREE.Object3D>();

export function getOrPrepareDetailRoomModel(
  gltfScene: THREE.Object3D,
  targetRoomSizeYUp: readonly [number, number, number],
): THREE.Object3D {
  const cached = preparedModelCache.get(gltfScene);
  if (cached) return cached;
  const model = prepareDetailRoomModel(gltfScene, targetRoomSizeYUp);
  preparedModelCache.set(gltfScene, model);
  return model;
}
