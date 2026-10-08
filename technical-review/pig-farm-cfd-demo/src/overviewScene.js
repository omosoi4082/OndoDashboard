import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BARN_LABEL_HEIGHT, BARNS, OVERVIEW_MODEL_URL, FALLBACK_POSITIONS } from './config.js';
import { createPlaceholderBarn, loadBarnComplex } from './barnFactory.js';

// 3개 방을 합친 박스 기준 초기 카메라 줌 — 숫자가 작을수록 더 당겨서(확대) 보인다.
// frameCameraToBox()를 부르는 두 곳(모델 로드 완료, refit())이 항상 같은 값을 쓰도록
// 상수로 뺐다 — 각자 다른 숫자를 하드코딩하면 상세 패널 열고 닫을 때(refit 호출)
// 줌이 갑자기 달라지는 버그가 생긴다.
const OVERVIEW_MARGIN_FACTOR = 1.4;

/**
 * ① 개요(overview) 씬 — 자돈·육성·비육 3개 방이 통합된 실측 모델을 보여준다
 * (2026-10-08, weaner_room_test-001.glb로 교체). 상세보기 패널은 항상 열려
 * 자돈방(id 0)만 표출하므로, 이 씬에는 클릭으로 축사를 선택하는 인터렉션이
 * 없다 — 육성·비육은 모델 자체가 이미 단일 회색 재질이라 코드에서 따로
 * 색을 바꾸지 않는다(barnFactory.js, config.js 참고)
 * (실제 화면 설계: 상세 패널은 실험군 자돈방만 대상, 육성·비육은 메인 표시 전용).
 */
export function createOverviewScene(mainCanvas) {
  // logarithmicDepthBuffer: 붙어있는 방들의 맞닿은 벽/바닥 경계처럼 카메라에서 먼 거리의
  // 근접한 면끼리 깊이값이 겹쳐 반짝이는(z-fighting) 현상을 줄여준다.
  const renderer = new THREE.WebGLRenderer({
    canvas: mainCanvas,
    antialias: true,
    logarithmicDepthBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef2f6);
  // 금속/플라스틱 재질(metalness/roughness)은 주변을 비추는 환경맵이 없으면
  // 빛이 정확히 반사각으로 들어올 때만 반짝이고 나머진 그냥 납작한 회색으로
  // 보인다 — three.js 기본 스튜디오 환경(RoomEnvironment)을 반사광으로만
  // 깔아서(배경 색은 그대로 두고) 재질 느낌을 살린다.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  // 참고 이미지(건축 프레젠테이션 렌더)처럼 그림자가 강하지 않고 전체적으로
  // 고르게 밝은 "제품샷" 톤 — 위/아래 톤이 다른 Hemisphere 라이트로 은은한
  // 그라데이션 필광을 깔고, 방향광은 약하게만 얹어 입체감만 살짝 준다.
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9dfe6, 0.55));
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(6, 12, 8);
  scene.add(dir);
  scene.add(dir.target);
  const fill = new THREE.DirectionalLight(0xffffff, 0.12);
  fill.position.set(-8, 6, -6);
  scene.add(fill);

  // 그림자는 메인 방향광(dir)이 담당한다 — 포인트 라이트 그림자는 다른
  // 채움광들에 묻혀 잘 안 보였다. 방향광은 정사영이라 방 전체에 고르게
  // 선명한 그림자를 드리운다. 정확한 위치/그림자 범위는 모델 로드 후
  // 실제 방 크기를 알고 나서 잡는다(아래 .then() 참고).
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.bias = -0.0015;

  // 실내등(포인트 라이트) — 은은한 채움광, 그림자는 안 준다(중복 방지).
  // 천장 팬 하우징 바로 근처에 오면 역제곱 법칙 때문에 그 지점만 하얗게
  // 떡지는 문제가 있었다 — 세기를 확 낮춘다(정확한 위치는 로드 후 재조정).
  const roomLight = new THREE.PointLight(0xfff2e0, 0.9, 0, 2);
  scene.add(roomLight);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
  camera.position.set(17, 26, 46);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(17, 1, 0);
  controls.enableDamping = true;
  // 회전 중심은 항상 고정(모델 전체 중심)으로 두고, 휠 줌만 마우스 커서가 가리키는 지점을
  // 향해 확대/축소되게 한다 — three.js OrbitControls 내장 옵션이라 별도 로직 없이 안정적이다.
  // (2026-10-09: "클릭한 지점 기준 회전"을 안전장치까지 넣어 다시 시도했으나 실제 브라우저에서
  // 예전과 같은 튐 버그가 재현되어 되돌림 — 이 데모에서는 이 기능을 만들지 않는다.)
  controls.zoomToCursor = true;

  const labelAnchors = new Map(); // barnId -> THREE.Vector3 (월드 좌표)
  let loadedFrameBox = null; // 초기 카메라가 맞춘 기준 박스(자돈·육성·비육 3개 방) — 창 크기 변경 시 재사용

  // 모델 로드가 끝나기 전(또는 실패 시) 보여줄 placeholder
  const placeholderGroups = BARNS.map((barn, i) => {
    const pos = FALLBACK_POSITIONS[i];
    const { group } = createPlaceholderBarn(barn, pos);
    scene.add(group);
    labelAnchors.set(barn.id, pos.clone().add(new THREE.Vector3(0, BARN_LABEL_HEIGHT, 0)));
    return group;
  });

  loadBarnComplex(OVERVIEW_MODEL_URL, BARNS)
    .then(({ modelRoot, sections }) => {
      // placeholder 제거, 실제 모델(서로 붙어있는 그대로)로 교체
      placeholderGroups.forEach((g) => scene.remove(g));
      labelAnchors.clear();

      scene.add(modelRoot);

      // 실내등 위치를 방 크기에 맞춰 천장 부근(살짝 아래)으로 옮기고,
      // 모델의 모든 메쉬가 그림자를 주고받도록 켠다.
      const modelBox = new THREE.Box3().setFromObject(modelRoot);
      const modelCenter = new THREE.Vector3();
      modelBox.getCenter(modelCenter);
      const modelSize = modelBox.getSize(new THREE.Vector3());
      roomLight.position.set(modelCenter.x, modelBox.max.y - 0.7, modelCenter.z);

      dir.position.set(
        modelCenter.x + modelSize.x * 0.4,
        modelBox.max.y + modelSize.y * 1.5,
        modelCenter.z + modelSize.z * 0.3,
      );
      dir.target.position.copy(modelCenter);
      dir.target.updateMatrixWorld();
      const half = Math.max(modelSize.x, modelSize.z) * 0.75;
      dir.shadow.camera.left = -half;
      dir.shadow.camera.right = half;
      dir.shadow.camera.top = half;
      dir.shadow.camera.bottom = -half;
      dir.shadow.camera.near = 0.1;
      dir.shadow.camera.far = modelSize.length() + 5;
      dir.shadow.camera.updateProjectionMatrix();

      modelRoot.traverse((o) => {
        if (!o.isMesh) return;
        o.receiveShadow = true;
        const isCutawayWall =
          o.material && o.material.name && o.material.name.startsWith('Plastic010');
        o.castShadow = !isCutawayWall;
      });

      sections.forEach(({ barnId, center, size }) => {
        labelAnchors.set(
          barnId,
          new THREE.Vector3(center.x, center.y + size.y / 2 + 0.4, center.z),
        );
      });

      // 초기 카메라는 모델 전체(길게 뻗은 덕트 구조물까지)가 아니라 자돈·육성·비육
      // 3개 방을 합친 박스를 기준으로 프레이밍한다 — 덕트까지 포함해서 맞추면 방들이
      // 작게 보이고, 반대로 방 1개만 기준으로 하면(이전 자돈사 A동 단독 모델 때 방식)
      // 나머지 방이 화면 밖으로 잘린다.
      loadedFrameBox =
        sections.reduce((box, s) => {
          const b = new THREE.Box3().setFromCenterAndSize(s.center, s.size);
          return box ? box.union(b) : b;
        }, null) ?? new THREE.Box3().setFromObject(modelRoot);
      // 회전 중심(= controls.target)을 3개 방 전체의 정확한 기하학적 중앙에서 자돈방
      // (카메라에 가까운 쪽) 방향으로 50% 옮긴다 — 자돈방 쪽에 여유를 주기 위함
      // (2026-10-09).
      const weanerCenter = sections.find((s) => s.barnId === 0)?.center;
      const rotationCenter = weanerCenter
        ? loadedFrameBox.getCenter(new THREE.Vector3()).lerp(weanerCenter, 0.5)
        : null;
      frameCameraToBox(camera, controls, loadedFrameBox, OVERVIEW_MARGIN_FACTOR, rotationCenter);
      console.info(`[barn-complex] 로드 완료 — 방 ${sections.length}개 매핑됨`);
      if (sections.length < BARNS.length) {
        console.warn(
          `[barn-complex] ${BARNS.length}개 중 ${sections.length}개만 매핑됨 — 위 "노드를 모델에서 찾지 못했습니다" 경고를 확인하세요.`,
        );
      }
    })
    .catch((err) => {
      console.warn(
        '[barn-complex] 모델 로드 실패 — placeholder 3개를 유지합니다.',
        OVERVIEW_MODEL_URL,
        err,
      );
    });

  // 라벨 (HTML 오버레이, 매 프레임 스크린 좌표로 갱신)
  const labelsRoot = document.getElementById('labels');
  const labelEls = BARNS.map((barn) => {
    const el = document.createElement('div');
    el.className = 'barn-label';
    el.textContent = barn.name;
    labelsRoot.appendChild(el);
    return el;
  });
  function updateLabels() {
    BARNS.forEach((barn, i) => {
      const worldPos = labelAnchors.get(barn.id);
      if (!worldPos) {
        labelEls[i].style.display = 'none';
        return;
      }
      const p = worldPos.clone().project(camera);
      const w = mainCanvas.clientWidth,
        h = mainCanvas.clientHeight;
      const x = (p.x * 0.5 + 0.5) * w;
      const y = (-p.y * 0.5 + 0.5) * h;
      labelEls[i].style.left = `${x}px`;
      labelEls[i].style.top = `${y}px`;
      labelEls[i].style.display = p.z > 1 ? 'none' : 'block';
    });
  }

  function resize() {
    const w = mainCanvas.clientWidth,
      h = mainCanvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // 상세 패널이 열리고/닫혀서 3D 뷰 폭이 바뀐 뒤(CSS 트랜지션 이후) 호출 — 전체 모델(방 3개)이
  // 항상 화면 안에 들어오도록 카메라를 다시 프레이밍한다. 일반 창 크기 변경(resize)에서는
  // 사용자가 돌려놓은 회전을 유지해야 하므로 호출하지 않는다.
  function refit() {
    if (loadedFrameBox) frameCameraToBox(camera, controls, loadedFrameBox, OVERVIEW_MARGIN_FACTOR);
  }

  function render() {
    controls.update();
    updateLabels();
    renderer.render(scene, camera);
  }

  return { scene, camera, renderer, resize, refit, render };
}

// box가 화면에 들어오도록 카메라를 그 기준으로 재배치한다. rotationCenter를 따로 주면
// 줌 거리(box 크기 기준)는 그대로 두고 "회전축 + 카메라가 서는 위치의 기준점" 둘 다
// 그 지점으로 옮긴다(기본은 box 중심).
function frameCameraToBox(camera, controls, box, marginFactor = 1.5, rotationCenter = null) {
  const size = new THREE.Vector3();
  box.getSize(size);
  const boxCenter = new THREE.Vector3();
  box.getCenter(boxCenter);
  const center = rotationCenter ?? boxCenter;

  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const dist = maxDim * marginFactor;

  camera.position.set(center.x + dist * 0.433, center.y + dist * 0.379, center.z + dist * 0.462);
  camera.near = Math.max(0.1, dist / 200);
  camera.far = dist * 10;
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.update();
}
