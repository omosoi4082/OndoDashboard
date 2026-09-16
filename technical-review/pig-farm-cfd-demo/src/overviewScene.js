import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BARN_LABEL_HEIGHT, BARNS, COMPLEX_MODEL_URL, FALLBACK_POSITIONS } from "./config.js";
import { createPlaceholderBarn, loadBarnComplex, resolveBarnId } from "./barnFactory.js";

/**
 * ① 개요(overview) 씬 — 축사 3개(서로 붙어있는 한 건물의 방 3개), 클릭으로 선택
 */
export function createOverviewScene(mainCanvas, { onSelectBarn }) {
  // logarithmicDepthBuffer: 붙어있는 방들의 맞닿은 벽/바닥 경계처럼 카메라에서 먼 거리의
  // 근접한 면끼리 깊이값이 겹쳐 반짝이는(z-fighting) 현상을 줄여준다.
  const renderer = new THREE.WebGLRenderer({ canvas: mainCanvas, antialias: true, logarithmicDepthBuffer: true });
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
  // 회전 중심은 항상 고정(모델 전체 중심)으로 두고, 휠 줌만 마우스 커서가 가리키는 지점을
  // 향해 확대/축소되게 한다 — three.js OrbitControls 내장 옵션이라 별도 로직 없이 안정적이다.
  controls.zoomToCursor = true;

  // 레이캐스트(클릭 판정용) 대상 — placeholder 단계에선 박스 3개, 모델 로드 후엔 modelRoot 하나로 교체된다.
  // 배열 참조를 그대로 유지하면서 내용만 바꾸므로, 아래에서 참조를 넘겨받는 클릭 핸들러는
  // 항상 최신 내용을 본다.
  const pickables = [];
  const labelAnchors = new Map(); // barnId -> THREE.Vector3 (월드 좌표)
  let loadedModelRoot = null; // 상세 패널이 열려 캔버스 폭이 줄어들 때 다시 프레이밍하기 위해 보관

  // 모델 로드가 끝나기 전(또는 실패 시) 보여줄 placeholder — 축사별로 따로 떨어뜨려 배치
  const placeholderGroups = BARNS.map((barn, i) => {
    const pos = FALLBACK_POSITIONS[i];
    const { group, hitMesh } = createPlaceholderBarn(barn, pos);
    scene.add(group);
    pickables.push(hitMesh);
    labelAnchors.set(barn.id, pos.clone().add(new THREE.Vector3(0, BARN_LABEL_HEIGHT, 0)));
    return group;
  });

  loadBarnComplex(COMPLEX_MODEL_URL, BARNS)
    .then(({ modelRoot, sections }) => {
      // placeholder 제거, 실제 모델(서로 붙어있는 그대로)로 교체
      placeholderGroups.forEach((g) => scene.remove(g));
      labelAnchors.clear();

      scene.add(modelRoot);
      // 방 3개가 서로 붙어있어도(경계가 맞닿아도) 실제로 클릭한 메시가 속한 방 노드가
      // 그대로 맞기 때문에, 별도 히트박스 없이 modelRoot 하나만 레이캐스트 대상으로 쓴다.
      pickables.length = 0;
      pickables.push(modelRoot);
      sections.forEach(({ barnId, center, size }) => {
        labelAnchors.set(barnId, new THREE.Vector3(center.x, center.y + size.y / 2 + 0.4, center.z));
      });

      loadedModelRoot = modelRoot;
      frameCameraToObject(camera, controls, modelRoot);
      console.info(`[barn-complex] 로드 완료 — 방 ${sections.length}개 매핑됨`);
      if (sections.length < BARNS.length) {
        console.warn(
          `[barn-complex] ${BARNS.length}개 중 ${sections.length}개만 매핑됨 — 위 "노드를 모델에서 찾지 못했습니다" 경고를 확인하세요.`
        );
      }
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
    const hits = raycaster.intersectObjects(pickables, true);
    if (hits.length > 0) {
      const barnId = resolveBarnId(hits[0].object);
      if (barnId !== null) onSelectBarn(barnId);
    }
  });
  mainCanvas.addEventListener("pointermove", (ev) => {
    const rect = mainCanvas.getBoundingClientRect();
    mouseNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouseNDC, camera);
    const hits = raycaster.intersectObjects(pickables, true);
    mainCanvas.style.cursor = hits.length > 0 && resolveBarnId(hits[0].object) !== null ? "pointer" : "default";
  });

  function resize() {
    const w = mainCanvas.clientWidth, h = mainCanvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // 상세 패널이 열리고/닫혀서 3D 뷰 폭이 바뀐 뒤(CSS 트랜지션 이후) 호출 — 전체 모델(방 3개)이
  // 항상 화면 안에 들어오도록 카메라를 다시 프레이밍한다. 일반 창 크기 변경(resize)에서는
  // 사용자가 돌려놓은 회전을 유지해야 하므로 호출하지 않는다.
  function refit() {
    if (loadedModelRoot) frameCameraToObject(camera, controls, loadedModelRoot);
  }

  function render() {
    controls.update();
    updateLabels();
    renderer.render(scene, camera);
  }

  return { scene, camera, renderer, resize, refit, render };
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
