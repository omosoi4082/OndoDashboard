import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ROOM } from "./config.js";

const gltfLoader = new GLTFLoader();
const gltfCache = new Map(); // url -> Promise<GLTF>
function loadGltf(url) {
  if (!gltfCache.has(url)) {
    gltfCache.set(url, new Promise((resolve, reject) => gltfLoader.load(url, resolve, undefined, reject)));
  }
  return gltfCache.get(url);
}

/**
 * 와이어프레임 박스 placeholder 축사 1개를 만든다.
 * COMPLEX_MODEL_URL 로드가 실패했을 때의 대체용.
 */
export function createPlaceholderBarn(barn, pos) {
  const group = new THREE.Group();
  group.position.copy(pos);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(ROOM.w * 0.5, ROOM.h * 0.5, ROOM.d * 0.5)),
    new THREE.LineBasicMaterial({ color: 0x5b6472 })
  );
  edges.position.set(0, ROOM.h * 0.25, 0);
  group.add(edges);

  const hitMesh = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM.w * 0.5, ROOM.h * 0.5, ROOM.d * 0.5),
    new THREE.MeshBasicMaterial({ color: 0x3b8bd4, transparent: true, opacity: 0.06 })
  );
  hitMesh.position.set(0, ROOM.h * 0.25, 0);
  hitMesh.userData.barnId = barn.id;
  group.add(hitMesh);

  return { group, hitMesh };
}

/**
 * COMPLEX_MODEL_URL 하나를 로드해서, 그 안에 서로 붙어있는 방 노드들을
 * barns[].modelNodeName 기준으로 찾아 축사 A/B/C의 클릭 영역으로 매핑한다.
 * 방 3개는 원본 파일에 있는 그대로(서로 붙은 채) 위치를 바꾸지 않는다 —
 * 모델 전체(modelRoot)만 바닥/중심 기준으로 한 번 정렬한다.
 *
 * @returns {Promise<{
 *   modelRoot: THREE.Object3D,
 *   sections: Array<{ barnId: number, node: THREE.Object3D, hitMesh: THREE.Mesh, center: THREE.Vector3, size: THREE.Vector3 }>
 * }>}
 */
export async function loadBarnComplex(url, barns) {
  const gltf = await loadGltf(url);
  const modelRoot = gltf.scene;

  groundAndCenterModel(modelRoot);
  modelRoot.updateMatrixWorld(true); // 위 정렬을 반영한 최종 월드 좌표를 아래에서 그대로 씀

  const sections = [];
  for (const barn of barns) {
    const node = modelRoot.getObjectByName(barn.modelNodeName);
    if (!node) {
      console.warn(`[barn:${barn.id}] "${barn.modelNodeName}" 노드를 모델에서 찾지 못했습니다.`);
      continue;
    }

    const box = new THREE.Box3().setFromObject(node);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const hitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(size.x, 0.1), Math.max(size.y, 0.1), Math.max(size.z, 0.1)),
      new THREE.MeshBasicMaterial({ color: 0x3b8bd4, transparent: true, opacity: 0.06 })
    );
    hitMesh.position.copy(center);
    hitMesh.userData.barnId = barn.id;

    sections.push({ barnId: barn.id, node, hitMesh, center, size });
  }

  return { modelRoot, sections };
}

// 모델 전체를 수평 중심 기준으로 정렬하고 바닥(y=0)에 붙인다.
// 내부 방 노드들 사이의 상대 위치(서로 붙어있는 구조)는 그대로 유지된다.
function groundAndCenterModel(modelRoot) {
  modelRoot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(modelRoot);
  const center = new THREE.Vector3();
  box.getCenter(center);
  modelRoot.position.x -= center.x;
  modelRoot.position.z -= center.z;
  modelRoot.position.y -= box.min.y;
}
