import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import { ROOM } from "./config.js";
import { MC_RESOLUTION, updateVolume } from "./volumeField.js";
import { createStreamlineController } from "./streamlines.js";

/**
 * ② 상세(detail) 씬 — 우측 패널 안의 별도 렌더러/카메라
 * 등온면(볼륨) + 기류 스트림라인 + 호버 조회를 담당한다.
 */
export function createDetailScene(detailCanvas, hoverTooltip) {
  const renderer = new THREE.WebGLRenderer({ canvas: detailCanvas, antialias: true, alpha: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(5, 8, 6);
  scene.add(dir);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.set(7, 5, 8);
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

  function marker(color, pos) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color }));
    m.position.copy(pos);
    scene.add(m);
  }
  marker(0x3b8bd4, new THREE.Vector3(0.8, 2.6, 0.8));
  marker(0xd85a30, new THREE.Vector3(ROOM.w - 0.8, 0.4, ROOM.d - 0.8));

  // 입체 확산 — Marching Cubes 등온면 (three.js 공식 애드온)
  const mcMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b8bd4, roughness: 0.35, metalness: 0.0,
    transparent: true, opacity: 0.85, side: THREE.DoubleSide,
  });
  const mcEffect = new MarchingCubes(MC_RESOLUTION, mcMaterial, false, false, 60000);
  mcEffect.position.set(ROOM.w / 2, ROOM.h / 2, ROOM.d / 2);
  mcEffect.scale.set(ROOM.w / 2, ROOM.h / 2, ROOM.d / 2);
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
