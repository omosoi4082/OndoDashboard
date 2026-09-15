import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BARN_LABEL_HEIGHT, BARNS, COMPLEX_MODEL_URL, FALLBACK_POSITIONS } from "./config.js";
import { createPlaceholderBarn, loadBarnComplex } from "./barnFactory.js";

/**
 * ① 개요(overview) 씬 — 축사 3개(서로 붙어있는 한 건물의 방 3개), 클릭으로 선택
 */
export function createOverviewScene(mainCanvas, { onSelectBarn }) {
  const renderer = new THREE.WebGLRenderer({ canvas: mainCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1116);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dir = new THREE.DirectionalLight(0xffffff, 0.5);
  dir.position.set(6, 12, 8);
  scene.add(dir);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
  camera.position.set(17, 26, 46);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(17, 1, 0);
  controls.enableDamping = true;

  const hitMeshes = [];
  const labelAnchors = new Map(); // barnId -> THREE.Vector3 (월드 좌표)

  // 모델 로드가 끝나기 전(또는 실패 시) 보여줄 placeholder — 축사별로 따로 떨어뜨려 배치
  const placeholderGroups = BARNS.map((barn, i) => {
    const pos = FALLBACK_POSITIONS[i];
    const { group, hitMesh } = createPlaceholderBarn(barn, pos);
    scene.add(group);
    hitMeshes.push(hitMesh);
    labelAnchors.set(barn.id, pos.clone().add(new THREE.Vector3(0, BARN_LABEL_HEIGHT, 0)));
    return group;
  });

  loadBarnComplex(COMPLEX_MODEL_URL, BARNS)
    .then(({ modelRoot, sections }) => {
      // placeholder 제거, 실제 모델(서로 붙어있는 그대로)로 교체
      placeholderGroups.forEach((g) => scene.remove(g));
      hitMeshes.length = 0;
      labelAnchors.clear();

      scene.add(modelRoot);
      sections.forEach(({ barnId, hitMesh, center, size }) => {
        scene.add(hitMesh);
        hitMeshes.push(hitMesh);
        labelAnchors.set(barnId, new THREE.Vector3(center.x, center.y + size.y / 2 + 0.4, center.z));
      });

      frameCameraToObject(camera, controls, modelRoot);
      console.info(`[barn-complex] 로드 완료 — 방 ${sections.length}개 매핑됨`);
    })
    .catch((err) => {
      console.warn("[barn-complex] 모델 로드 실패 — placeholder 3개를 유지합니다.", COMPLEX_MODEL_URL, err);
    });

  // 라벨 (HTML 오버레이, 매 프레임 스크린 좌표로 갱신)
  const labelsRoot = document.getElementById("labels");
  const labelEls = BARNS.map((barn) => {
    const el = document.createElement("div");
    el.className = "barn-label";
    el.textContent = barn.name;
    labelsRoot.appendChild(el);
    return el;
  });
  function updateLabels() {
    BARNS.forEach((barn, i) => {
      const worldPos = labelAnchors.get(barn.id);
      if (!worldPos) {
        labelEls[i].style.display = "none";
        return;
      }
      const p = worldPos.clone().project(camera);
      const w = mainCanvas.clientWidth, h = mainCanvas.clientHeight;
      const x = (p.x * 0.5 + 0.5) * w;
      const y = (-p.y * 0.5 + 0.5) * h;
      labelEls[i].style.left = `${x}px`;
      labelEls[i].style.top = `${y}px`;
      labelEls[i].style.display = p.z > 1 ? "none" : "block";
    });
  }

  // 클릭 선택
  const raycaster = new THREE.Raycaster();
  const mouseNDC = new THREE.Vector2();
  mainCanvas.addEventListener("click", (ev) => {
    const rect = mainCanvas.getBoundingClientRect();
    mouseNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouseNDC, camera);
    const hits = raycaster.intersectObjects(hitMeshes);
    if (hits.length > 0) onSelectBarn(hits[0].object.userData.barnId);
  });
  mainCanvas.addEventListener("pointermove", (ev) => {
    const rect = mainCanvas.getBoundingClientRect();
    mouseNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouseNDC, camera);
    const hits = raycaster.intersectObjects(hitMeshes);
    mainCanvas.style.cursor = hits.length > 0 ? "pointer" : "default";
  });

  function resize() {
    const w = mainCanvas.clientWidth, h = mainCanvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render() {
    controls.update();
    updateLabels();
    renderer.render(scene, camera);
  }

  return { scene, camera, renderer, resize, render };
}

// object 전체가 화면에 들어오도록 카메라를 그 바운딩 박스 기준으로 재배치한다.
function frameCameraToObject(camera, controls, object, marginFactor = 1.5) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const dist = maxDim * marginFactor;

  camera.position.set(center.x + dist * 0.55, center.y + dist * 0.5, center.z + dist * 0.7);
  camera.near = Math.max(0.1, dist / 200);
  camera.far = dist * 10;
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.update();
}
