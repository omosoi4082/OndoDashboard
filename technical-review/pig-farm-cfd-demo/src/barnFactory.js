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
 * 클릭 판정용으로 별도의 박스 메시를 만들지 않고, 각 방 노드 자체에
 * userData.barnId를 붙인다 — modelRoot를 재귀적으로 레이캐스트해서 맞은 메시에서
 * 부모 쪽으로 올라가며 barnId를 찾으면, 방 3개가 서로 붙어있어도(경계가 맞닿아도)
 * 항상 "실제로 클릭한 방"이 정확히 선택된다.
 *
 * @returns {Promise<{
 *   modelRoot: THREE.Object3D,
 *   sections: Array<{ barnId: number, node: THREE.Object3D, center: THREE.Vector3, size: THREE.Vector3 }>
 * }>}
 */
// GLTFLoader는 노드 이름을 애니메이션 바인딩 경로에 쓸 수 있게 "정제"하면서
// 예약 문자 [ ] . : / 를 전부 제거한다(three.js PropertyBinding.sanitizeNodeName와 동일 규칙).
// Blender는 중복된 오브젝트 이름 뒤에 ".001", ".002"를 자동으로 붙이므로, 로드된 실제
// object3D.name은 "P1.001"이 아니라 "P1001"이 된다 — 원본 파일/README에 적힌 이름 그대로
// getObjectByName()을 호출하면 점(.)이 있는 이름은 항상 못 찾는다. 조회 전에 같은 규칙으로
// 정제해서, config.js/README에는 사람이 읽기 쉬운 원래 이름("P1.001")을 그대로 써도 되게 한다.
function sanitizeNodeName(name) {
  return name.replace(/\s/g, "_").replace(/[[\].:/]/g, "");
}

export async function loadBarnComplex(url, barns) {
  const gltf = await loadGltf(url);
  const modelRoot = gltf.scene;

  groundAndCenterModel(modelRoot);
  modelRoot.updateMatrixWorld(true); // 위 정렬을 반영한 최종 월드 좌표를 아래에서 그대로 씀

  const sections = [];
  for (const barn of barns) {
    const node = modelRoot.getObjectByName(sanitizeNodeName(barn.modelNodeName));
    if (!node) {
      console.warn(`[barn:${barn.id}] "${barn.modelNodeName}" 노드를 모델에서 찾지 못했습니다.`);
      continue;
    }

    node.userData.barnId = barn.id;

    const box = new THREE.Box3().setFromObject(node);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    sections.push({ barnId: barn.id, node, center, size });
  }

  return { modelRoot, sections };
}

/** hit(레이캐스트로 맞은 메시)에서 부모 쪽으로 올라가며 가장 가까운 userData.barnId를 찾는다. */
export function resolveBarnId(object) {
  let o = object;
  while (o) {
    if (o.userData && o.userData.barnId !== undefined) return o.userData.barnId;
    o = o.parent;
  }
  return null;
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
