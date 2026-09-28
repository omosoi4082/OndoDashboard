import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { ROOM, COMPLEX_MODEL_URL } from "./config.js";
import { MC_RESOLUTION, updateVolume } from "./volumeField.js";
import { createStreamlineController } from "./streamlines.js";
import { applyCameraCutaway } from "./barnFactory.js";

// barnFactory.js의 sanitizeNodeName과 동일 규칙 — GLTFLoader가 노드 이름에서
// 예약 문자 [ ] . : / 를 제거하므로("P1.001" → "P1001"), 조회 전에 똑같이 정제한다.
function sanitizeNodeName(name) {
  return name.replace(/\s/g, "_").replace(/[[\].:/]/g, "");
}

/**
 * ② 상세(detail) 씬 — 우측 패널 안의 별도 렌더러/카메라
 * 등온면(볼륨) + 기류 스트림라인 + 호버 조회를 담당한다.
 */
export function createDetailScene(detailCanvas, hoverTooltip) {
  const renderer = new THREE.WebGLRenderer({ canvas: detailCanvas, antialias: true, alpha: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9dfe6, 0.55));
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(ROOM.w / 2 + 2, ROOM.h + 3, ROOM.d / 2 + 1.5);
  dir.target.position.set(ROOM.w / 2, 0, ROOM.d / 2);
  scene.add(dir);
  scene.add(dir.target);
  const fill = new THREE.DirectionalLight(0xffffff, 0.12);
  fill.position.set(-6, 4, -5);
  scene.add(fill);

  // 돼지/바닥/벽에 접촉 그림자를 줘서 붕 떠 보이지 않게 한다 — 포인트 라이트
  // 그림자는 다른 조명들에 가려 잘 안 보여서, 대신 메인 방향광(dir)에
  // 그림자를 맡기고 방 크기에 맞춘 정사영 그림자 카메라를 씌운다.
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.bias = -0.0015;
  const half = Math.max(ROOM.w, ROOM.d) * 0.75;
  dir.shadow.camera.left = -half;
  dir.shadow.camera.right = half;
  dir.shadow.camera.top = half;
  dir.shadow.camera.bottom = -half;
  dir.shadow.camera.near = 0.1;
  dir.shadow.camera.far = ROOM.w + ROOM.h + ROOM.d + 5;
  dir.shadow.camera.updateProjectionMatrix();

  // 실내등(포인트 라이트)은 그림자 없이 은은한 채움광으로만 둔다.
  // 천장 팬 하우징 바로 위/근처에 오면 역제곱 법칙 때문에 그 지점만 하얗게
  // 떡지는 문제가 있었다 — 세기를 확 낮추고 천장에서 더 띄운다.
  const roomLight = new THREE.PointLight(0xfff2e0, 0.8, 0, 2);
  roomLight.position.set(ROOM.w / 2, ROOM.h - 0.7, ROOM.d / 2);
  scene.add(roomLight);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.set(ROOM.w * 1.05, ROOM.h * 1.25, ROOM.d * 1.3);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(ROOM.w / 2, ROOM.h / 2, ROOM.d / 2);
  controls.enableDamping = true;
  controls.zoomToCursor = true; // 휠 줌만 커서가 가리키는 지점 방향으로 (회전 중심은 고정)

  const roomBox = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(ROOM.w, ROOM.h, ROOM.d)),
    new THREE.LineBasicMaterial({ color: 0x4a5568 })
  );
  roomBox.position.set(ROOM.w / 2, ROOM.h / 2, ROOM.d / 2);
  scene.add(roomBox);

  // 개요 씬과 같은 실측 모델(p1.glb)을 상세 패널에도 그대로 띄운다 — 추상적인
  // CFD 볼륨/스트림라인이 실제 어떤 방 안에서 벌어지는 일인지 바로 보이게.
  // 노드별로 캐시해서, 축사를 여러 번 눌러도 매번 새로 로드/클론하지 않는다.
  const realModelLoader = new GLTFLoader();
  const realModelCache = new Map(); // sanitizedNodeName -> THREE.Object3D (clone, scene에 아직 안 붙음)
  let currentRealModel = null;
  let realModelGltfPromise = null;

  function ensureRealModel(barn) {
    if (!barn) return;
    if (!realModelGltfPromise) {
      realModelGltfPromise = new Promise((resolve, reject) =>
        realModelLoader.load(COMPLEX_MODEL_URL, resolve, undefined, reject)
      );
    }
    realModelGltfPromise
      .then((gltf) => {
        const key = sanitizeNodeName(barn.modelNodeName);
        let model = realModelCache.get(key);
        if (!model) {
          // 이름으로 못 찾으면(내보내기 방식에 따라 씬 루트 자체가 그 노드일 수도 있다)
          // gltf.scene 전체를 그대로 쓴다 — 지금은 바동 1개뿐이라 이래도 안전하다.
          const src = gltf.scene.getObjectByName(key) || gltf.scene;
          model = src.clone(true);

          // 상세보기는 두께 없는 판 벽/천장만 쓴다 (컷어웨이 셰이더가 두께 있는
          // 벽에서는 안쪽 면이 겹쳐 이상해지므로) — 두꺼운(메인 화면용) 버전은 숨긴다.
          // ★ 바운딩 박스를 재기 "전에" 숨겨야 한다 — 안 그러면 두꺼운 벽까지
          // 포함해서 잰 크기로 스케일을 계산해서 판 벽 쪽이 박스보다 작아지고,
          // 그 틈으로 마커/기류가 방 밖으로 새어 보이는 문제가 있었다.
          for (const name of ["PigRoom_Walls_Solid", "PigRoom_RoofPanel_Solid"]) {
            const n = model.getObjectByName(name);
            if (n) n.visible = false;
          }

          // 스케일 기준 박스는 "방 껍질"(바닥+벽)만으로 잰다 — 지붕/팬 하우징처럼
          // 방 바깥으로 튀어나온 부분까지 포함하면 그만큼 방 높이가 실제보다
          // 크게 측정돼서 벽 윗부분이 짧아지고 천장과 틈이 벌어지는 문제가 있었다.
          const shellBox = new THREE.Box3();
          const floorNode = model.getObjectByName("PigRoom_FloorSlab");
          const wallNode = model.getObjectByName("PigRoom_Walls_Flat");
          if (floorNode) shellBox.expandByObject(floorNode);
          if (wallNode) shellBox.expandByObject(wallNode);
          const box = shellBox.isEmpty() ? new THREE.Box3().setFromObject(model) : shellBox;
          const size = new THREE.Vector3();
          box.getSize(size);
          // 축마다 다르게 스케일해서 ROOM 박스를 정확히 꽉 채운다 — ROOM이 이제
          // 실측 치수에 가깝게 맞춰져 있어서 왜곡은 거의 안 생기고, 그러면서도
          // 마커/기류가 절대 방 밖으로 새지 않는 걸 보장한다.
          const scaleX = ROOM.w / size.x || 1;
          const scaleY = ROOM.h / size.y || 1;
          const scaleZ = ROOM.d / size.z || 1;
          model.scale.set(scaleX, scaleY, scaleZ);
          const center = new THREE.Vector3();
          box.getCenter(center);
          // roomBox/mcEffect/마커는 원점이 아니라 ROOM 박스 중심(ROOM.w/2, ROOM.d/2)
          // 기준으로 배치돼 있다 — 모델도 같은 기준점에 맞춰야 온도/기류 데이터가
          // 실제 방 안쪽에 겹쳐 보인다.
          model.position.set(ROOM.w / 2 - center.x * scaleX, -box.min.y * scaleY, ROOM.d / 2 - center.z * scaleZ);

          applyCameraCutaway(model); // 카메라 쪽 벽/천장은 여기서도 똑같이 투명 처리
          model.traverse((o) => {
            if (!o.isMesh) return;
            o.receiveShadow = true;
            // 컷어웨이 벽/천장은 그림자를 "쏘지" 않게 한다 — 그림자맵은 광원 기준으로
            // 앞/뒷면이 갈려서, 카메라 기준으로 투명해진 면이 광원 쪽에서는 안 뚫려
            // 보일 수 있어 벽이 이상한 그림자를 드리울 수 있다.
            const isCutawayWall = o.material && o.material.name && o.material.name.startsWith("Plastic010");
            o.castShadow = !isCutawayWall;
          });
          realModelCache.set(key, model);
        }
        if (currentRealModel !== model) {
          if (currentRealModel) scene.remove(currentRealModel);
          scene.add(model);
          currentRealModel = model;
          roomBox.visible = false; // 실측 모델이 있으면 단순 와이어프레임 박스는 숨긴다
        }
      })
      .catch((err) => console.warn("[detail] 실측 모델 로드 실패 — 와이어프레임 박스를 유지합니다.", err));
  }

  function marker(color, pos) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color }));
    m.position.copy(pos);
    scene.add(m);
  }
  // ROOM이 이제 실측 방 크기(4.7×2.8×4.2)라, 예전 가상 크기(8×3×5) 기준
  // 절대좌표(0.8, 2.6 등)를 그대로 쓰면 벽 밖으로 나간다 — 방 크기에 비례한
  // 여유(15%)를 두고 계산해서 어떤 방 크기에서도 항상 안쪽에 들어오게 한다.
  const inset = Math.min(ROOM.w, ROOM.d) * 0.15;
  marker(0x3b8bd4, new THREE.Vector3(inset, ROOM.h - inset, inset));
  marker(0xd85a30, new THREE.Vector3(ROOM.w - inset, inset * 0.6, ROOM.d - inset));

  // 입체 확산 — Marching Cubes 등온면 (three.js 공식 애드온)
  const mcMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b8bd4, roughness: 0.35, metalness: 0.0,
    transparent: true, opacity: 0.85, side: THREE.DoubleSide,
  });
  const mcEffect = new MarchingCubes(MC_RESOLUTION, mcMaterial, false, false, 60000);
  mcEffect.position.set(ROOM.w / 2, ROOM.h / 2, ROOM.d / 2);
  // 등온면이 경계 바로 위에서 생성되면 볼록한 부분이 벽/천장을 살짝 뚫고
  // 나가 방 밖에서도 보이는 문제가 있었다 — 살짝(6%) 안쪽으로 여유를 둬서
  // 항상 방 안에 완전히 갇히게 한다.
  const mcMargin = 0.94;
  mcEffect.scale.set((ROOM.w / 2) * mcMargin, (ROOM.h / 2) * mcMargin, (ROOM.d / 2) * mcMargin);
  mcEffect.isolation = 60;
  scene.add(mcEffect);

  const streams = createStreamlineController(scene);

  let currentFrameArray = null; // 현재 프레임의 실제 격자값 — 호버 조회에 사용
  let selectedBarn = null;

  const hoverRay = new THREE.Raycaster();
  const hoverNDC = new THREE.Vector2();
  const _localPt = new THREE.Vector3();

  detailCanvas.addEventListener("pointermove", (ev) => {
    if (!selectedBarn || !mcEffect.visible || !currentFrameArray) {
      hoverTooltip.style.display = "none";
      return;
    }
    const rect = detailCanvas.getBoundingClientRect();
    hoverNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    hoverNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    hoverRay.setFromCamera(hoverNDC, camera);
    const hits = hoverRay.intersectObject(mcEffect);

    if (hits.length === 0) {
      hoverTooltip.style.display = "none";
      return;
    }

    _localPt.copy(hits[0].point);
    mcEffect.worldToLocal(_localPt); // 표면 메시의 로컬 좌표(-1~1)로 변환
    const size = MC_RESOLUTION;
    const gi = Math.min(size - 1, Math.max(0, Math.round(((_localPt.x + 1) / 2) * (size - 1))));
    const gj = Math.min(size - 1, Math.max(0, Math.round(((_localPt.y + 1) / 2) * (size - 1))));
    const gk = Math.min(size - 1, Math.max(0, Math.round(((_localPt.z + 1) / 2) * (size - 1))));
    const raw = currentFrameArray[gi + gj * size + gk * size * size] / 200; // 0~1 정규화 값
    const tempC = 28 + raw * 6; // 표시용 — 실제 연동 시 물리 단위(°C 등)로 교체

    const p = hits[0].point;
    hoverTooltip.innerHTML =
      `<span class="k">x</span> ${p.x.toFixed(2)}m &nbsp;` +
      `<span class="k">y</span> ${p.y.toFixed(2)}m &nbsp;` +
      `<span class="k">z</span> ${p.z.toFixed(2)}m<br/>` +
      `<span class="k">value</span> ${tempC.toFixed(1)}°C`;
    hoverTooltip.style.left = `${ev.clientX - rect.left + 14}px`;
    hoverTooltip.style.top = `${ev.clientY - rect.top + 14}px`;
    hoverTooltip.style.display = "block";
  });
  detailCanvas.addEventListener("pointerleave", () => {
    hoverTooltip.style.display = "none";
  });

  function setSelectedBarn(barn) {
    selectedBarn = barn;
    if (barn) {
      ensureRealModel(barn);
    } else if (currentRealModel) {
      scene.remove(currentRealModel);
      currentRealModel = null;
      roomBox.visible = true;
    }
  }

  function resize(wrapEl) {
    const w = wrapEl.clientWidth, h = wrapEl.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render({ tMin, showVolume, showStreams, spreadIntensity, delta }) {
    if (!selectedBarn) return;

    mcEffect.visible = showVolume;
    streams.group.visible = showStreams;

    if (showVolume) {
      currentFrameArray = updateVolume(mcEffect, mcMaterial, tMin, selectedBarn, spreadIntensity);
    }
    if (showStreams) {
      streams.rebuild(tMin, selectedBarn);
      streams.update(delta);
    }

    controls.update();
    renderer.render(scene, camera);
  }

  return { scene, camera, renderer, controls, setSelectedBarn, resize, render };
}
