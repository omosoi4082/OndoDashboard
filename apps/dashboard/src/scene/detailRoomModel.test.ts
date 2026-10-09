import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  DETAIL_ROOM_NODE_NAMES,
  applyCameraCutaway,
  cloneRoomRoot,
  computeRoomFitTransform,
  computeShellBox,
  hideSolidShellNodes,
  prepareDetailRoomModel,
} from './detailRoomModel.js';

function boxMesh(
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  materialName?: string,
): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial();
  if (materialName) material.name = materialName;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  return mesh;
}

/**
 * p1.glb 실제 구조(2026-10-09 glb 파싱 확인: P1 루트, PigRoom_FloorSlab/Walls_Flat이
 * 방 "껍질", PigRoom_Walls_Solid/RoofPanel_Solid는 상세에서 숨겨지는 두꺼운 버전,
 * Walls_Flat/Roof_Flat는 Plastic010 머티리얼 공유)와 같은 모양의 가짜 모델.
 */
function buildFakeRoomModel(): THREE.Group {
  const root = new THREE.Group();
  root.name = DETAIL_ROOM_NODE_NAMES.root;
  // 얇은 "껍질"(방 전체를 덮는 2x2x2 바닥+벽) — 스케일 기준.
  root.add(boxMesh(DETAIL_ROOM_NODE_NAMES.floor, [2, 0.1, 2], [0, 0, 0], 'Concrete042A'));
  root.add(boxMesh(DETAIL_ROOM_NODE_NAMES.flatWalls, [2, 2, 2], [0, 1, 0], 'Plastic010'));
  // 두꺼운(메인 화면용) 버전 — 상세에서는 숨겨져야 하고, 숨기기 전에 재면 더 큰 박스가 잡힌다.
  root.add(boxMesh(DETAIL_ROOM_NODE_NAMES.solidWalls, [2.4, 2.4, 2.4], [0, 1.2, 0], 'PR_RoomGlassGrid'));
  root.add(boxMesh(DETAIL_ROOM_NODE_NAMES.solidRoof, [2.4, 0.3, 2.4], [0, 2.4, 0], 'Plastic010'));
  // 돼지 — 숨기지도 컷어웨이 대상도 아닌, 그대로 유지되는 노드.
  root.add(boxMesh('Pig_01', [0.3, 0.3, 0.5], [0.5, 0.15, 0.5], 'Cloth_Weave_White_1mm'));
  root.updateMatrixWorld(true);
  return root;
}

function wrapInGltfScene(root: THREE.Group): THREE.Group {
  const scene = new THREE.Group();
  scene.add(root);
  scene.updateMatrixWorld(true);
  return scene;
}

describe('cloneRoomRoot', () => {
  it('"P1" 노드를 찾아 clone한다(원본은 그대로 둔다)', () => {
    const gltfScene = wrapInGltfScene(buildFakeRoomModel());
    const clone = cloneRoomRoot(gltfScene);
    expect(clone.name).toBe('P1');
    expect(clone).not.toBe(gltfScene.getObjectByName('P1'));
  });

  it('"P1" 노드가 없으면 scene 전체를 clone한다', () => {
    const scene = new THREE.Group();
    scene.name = 'Scene';
    scene.add(boxMesh('SomethingElse', [1, 1, 1], [0, 0, 0]));
    const clone = cloneRoomRoot(scene);
    expect(clone.name).toBe('Scene');
  });
});

describe('hideSolidShellNodes', () => {
  it('두꺼운 벽/천장(Solid)만 숨기고 판 벽(Flat)·바닥·돼지는 그대로 둔다', () => {
    const model = buildFakeRoomModel();
    hideSolidShellNodes(model);
    expect(model.getObjectByName(DETAIL_ROOM_NODE_NAMES.solidWalls)?.visible).toBe(false);
    expect(model.getObjectByName(DETAIL_ROOM_NODE_NAMES.solidRoof)?.visible).toBe(false);
    expect(model.getObjectByName(DETAIL_ROOM_NODE_NAMES.flatWalls)?.visible).toBe(true);
    expect(model.getObjectByName(DETAIL_ROOM_NODE_NAMES.floor)?.visible).toBe(true);
    expect(model.getObjectByName('Pig_01')?.visible).toBe(true);
  });
});

describe('computeShellBox', () => {
  it('바닥+판 벽(Flat)만으로 박스를 잰다 — 두꺼운 Solid 버전을 숨긴 뒤에는 크기가 커지지 않는다', () => {
    const model = buildFakeRoomModel();
    hideSolidShellNodes(model);
    const box = computeShellBox(model);
    const size = box.getSize(new THREE.Vector3());
    // Walls_Flat([2,2,2] @ y=1)과 FloorSlab([2,0.1,2] @ y=0)을 합친 박스: y는 -0.05~2.0.
    expect(size.x).toBeCloseTo(2, 5);
    expect(size.z).toBeCloseTo(2, 5);
    expect(size.y).toBeCloseTo(2.05, 5);
  });

  it('바닥/판 벽 노드가 없으면 모델 전체 바운딩박스로 대체한다', () => {
    const model = new THREE.Group();
    model.add(boxMesh('Unrelated', [1, 1, 1], [0, 0, 0]));
    model.updateMatrixWorld(true);
    const box = computeShellBox(model);
    expect(box.isEmpty()).toBe(false);
  });
});

describe('computeRoomFitTransform', () => {
  it('축마다 다른 비율로 목표 치수를 정확히 채우도록 스케일하고, 중심/바닥을 맞춘다', () => {
    const shellBox = new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1)); // size (2,2,2), center (0,1,0)
    const targetSize = new THREE.Vector3(4.5, 2.8, 4.0); // geometry.room.size 예시(y-up 변환 후)
    const { scale, position } = computeRoomFitTransform(shellBox, targetSize, { x: 2.25, z: 2.0 });

    expect(scale.x).toBeCloseTo(4.5 / 2, 5);
    expect(scale.y).toBeCloseTo(2.8 / 2, 5);
    expect(scale.z).toBeCloseTo(4.0 / 2, 5);

    // x/z: targetCenter - center*scale (center.x=0,center.z=0이므로 그대로 targetCenter)
    expect(position.x).toBeCloseTo(2.25, 5);
    expect(position.z).toBeCloseTo(2.0, 5);
    // y: -shellBox.min.y(=0)*scaleY = 0
    expect(position.y).toBeCloseTo(0, 5);
  });

  it('바닥이 원점이 아닌 박스도 바닥을 y=0에 맞춘다', () => {
    const shellBox = new THREE.Box3(new THREE.Vector3(0, 5, 0), new THREE.Vector3(2, 7, 2)); // min.y=5
    const { position } = computeRoomFitTransform(shellBox, new THREE.Vector3(2, 2, 2), { x: 1, z: 1 });
    // scaleY = 2/2 = 1, position.y = -5*1 = -5 → 모델의 min.y(5)가 최종 y=0에 오게 된다.
    expect(position.y).toBeCloseTo(-5, 5);
  });
});

describe('applyCameraCutaway', () => {
  it('Plastic010 머티리얼에만 DoubleSide + discard 셰이더를 적용한다', () => {
    const model = buildFakeRoomModel();
    applyCameraCutaway(model);

    const flatWallsMat = (model.getObjectByName(DETAIL_ROOM_NODE_NAMES.flatWalls) as THREE.Mesh)
      .material as THREE.Material;
    expect(flatWallsMat.side).toBe(THREE.DoubleSide);
    expect(flatWallsMat.transparent).toBe(false);
    expect(typeof flatWallsMat.onBeforeCompile).toBe('function');

    const floorMat = (model.getObjectByName(DETAIL_ROOM_NODE_NAMES.floor) as THREE.Mesh).material as THREE.Material;
    expect(floorMat.side).not.toBe(THREE.DoubleSide);

    const pigMat = (model.getObjectByName('Pig_01') as THREE.Mesh).material as THREE.Material;
    expect(pigMat.side).not.toBe(THREE.DoubleSide);
  });

  it('같은 머티리얼 인스턴스를 공유하는 두 메시(Walls_Flat/Roof_Flat)를 두 번 패치하지 않는다', () => {
    const model = buildFakeRoomModel();
    const sharedMaterial = new THREE.MeshStandardMaterial({ name: 'Plastic010' });
    (model.getObjectByName(DETAIL_ROOM_NODE_NAMES.flatWalls) as THREE.Mesh).material = sharedMaterial;
    (model.getObjectByName(DETAIL_ROOM_NODE_NAMES.solidRoof) as THREE.Mesh).material = sharedMaterial;

    applyCameraCutaway(model);
    expect(sharedMaterial.side).toBe(THREE.DoubleSide);
  });
});

describe('prepareDetailRoomModel', () => {
  it('두꺼운 벽을 숨기고, 목표 방 크기에 맞춰 스케일/배치하고, 컷어웨이·그림자 플래그까지 적용한다', () => {
    const gltfScene = wrapInGltfScene(buildFakeRoomModel());
    const targetRoomSizeYUp: [number, number, number] = [4.5, 2.8, 4.0];
    const prepared = prepareDetailRoomModel(gltfScene, targetRoomSizeYUp);

    expect(prepared.getObjectByName(DETAIL_ROOM_NODE_NAMES.solidWalls)?.visible).toBe(false);

    prepared.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const floor = prepared.getObjectByName(DETAIL_ROOM_NODE_NAMES.floor);
    const walls = prepared.getObjectByName(DETAIL_ROOM_NODE_NAMES.flatWalls);
    if (floor) box.expandByObject(floor);
    if (walls) box.expandByObject(walls);
    const size = box.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(4.5, 2);
    expect(size.z).toBeCloseTo(4.0, 2);
    expect(box.min.y).toBeCloseTo(0, 2);

    const wallsMesh = prepared.getObjectByName(DETAIL_ROOM_NODE_NAMES.flatWalls) as THREE.Mesh;
    expect(wallsMesh.receiveShadow).toBe(true);
    expect(wallsMesh.castShadow).toBe(false); // 컷어웨이 벽은 그림자를 쏘지 않는다.

    const pigMesh = prepared.getObjectByName('Pig_01') as THREE.Mesh;
    expect(pigMesh.castShadow).toBe(true);
  });

  it('원본 gltfScene 트리는 보이지 않는 처리/스케일 변경 없이 그대로 유지된다', () => {
    const gltfScene = wrapInGltfScene(buildFakeRoomModel());
    const originalSolidWalls = gltfScene.getObjectByName(DETAIL_ROOM_NODE_NAMES.solidWalls);
    prepareDetailRoomModel(gltfScene, [4.5, 2.8, 4.0]);
    expect(originalSolidWalls?.visible).toBe(true);
    expect(gltfScene.getObjectByName(DETAIL_ROOM_NODE_NAMES.root)?.scale.x).toBe(1);
  });
});
