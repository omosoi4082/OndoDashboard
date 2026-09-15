import * as THREE from "three";
import { ROOM } from "./config.js";

// 기류 흐름 — 실제 유속장(u,v,w)을 따라 좌표를 적분해서 스트림라인 3개를 만듦
function flowDashTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 8;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(255,255,255,0)";
  ctx.fillRect(0, 0, 64, 8);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(4, 1, 26, 6);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
const dashTexture = flowDashTexture();

// 임의 좌표(x,y,z)에서의 유속 벡터 — 실제 연동 시 CFD 프레임의 (u,v,w) 격자로 교체
function sampleVelocityAt(x, y, z, tMin, barn) {
  const inletX = 0.8 + barn.seed * 0.4, inletZ = 0.8 + barn.seed * 0.3;
  const decay = 1 - 0.3 * Math.min((tMin * (barn.ach / 20)) / 60, 1);
  const dist = Math.hypot(x - inletX, y - 2.6, z - inletZ);
  const jetMag = Math.exp(-dist * 0.35) * 1.4 * decay;
  const u = jetMag * 0.55 + 0.08 * Math.sin(z * 1.4 + tMin * 0.05);
  const v = -jetMag * 0.5;
  const w = jetMag * 0.55 + 0.08 * Math.cos(x * 1.4 - tMin * 0.05);
  return { u, v, w, mag: Math.hypot(u, v, w) };
}

// 시작점(seed)에서 출발해 유속 방향으로 한 걸음씩 이동하며 좌표를 쌓는 적분(스트림라인 추적)
function traceStreamline(seed, tMin, barn) {
  const pts = [new THREE.Vector3(seed[0], seed[1], seed[2])];
  let p = pts[0];
  const stepSize = 0.22;
  for (let i = 0; i < 40; i++) {
    const vel = sampleVelocityAt(p.x, p.y, p.z, tMin, barn);
    if (vel.mag < 0.02) break;
    const dir = new THREE.Vector3(vel.u, vel.v, vel.w).normalize();
    const next = p.clone().addScaledVector(dir, stepSize);
    if (next.x < 0 || next.x > ROOM.w || next.y < 0 || next.y > ROOM.h || next.z < 0 || next.z > ROOM.d) break;
    pts.push(next);
    p = next;
  }
  return pts;
}

function makeStreamTubeFromPoints(points) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, Math.max(points.length * 3, 20), 0.045, 8, false);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x5dcaa5, emissive: 0x0f6e56, emissiveIntensity: 0.4,
    map: dashTexture, transparent: true, roughness: 0.4,
  });
  mat.map.repeat.set(10, 1);
  return new THREE.Mesh(geo, mat);
}

export function createStreamlineController(scene) {
  const streamGroup = new THREE.Group();
  scene.add(streamGroup);

  let lastStreamKey = null;

  function rebuild(tMin, barn) {
    const key = `${tMin}-${barn.id}`;
    if (key === lastStreamKey) return; // 이 프레임으로 이미 만들어져 있으면 다시 추적하지 않음
    lastStreamKey = key;
    while (streamGroup.children.length) {
      const m = streamGroup.children.pop();
      m.geometry.dispose();
    }
    const inletX = 0.8 + barn.seed * 0.4, inletZ = 0.8 + barn.seed * 0.3;
    const seeds = [
      [inletX, 2.6, inletZ],
      [inletX, 2.6, inletZ + 0.5],
      [inletX, 2.6, inletZ - 0.5],
    ];
    seeds.forEach((seed) => {
      const pts = traceStreamline(seed, tMin, barn);
      if (pts.length >= 2) streamGroup.add(makeStreamTubeFromPoints(pts));
    });
  }

  function update(delta) {
    streamGroup.children.forEach((mesh) => {
      mesh.material.map.offset.x -= delta * 0.5; // 흐르는 방향으로 스크롤
    });
  }

  return { group: streamGroup, rebuild, update };
}
