import * as THREE from "three";

/* ────────────────────────────────────────────────────────────
   공용 상수: 방(축사 내부) 크기 — 상세(detail) 씬의 합성 CFD 볼륨/
   스트림라인 계산에 쓰이는 가상의 방 치수. 개요 씬의 실제 3D 모델
   치수와는 별개다 (실제 모델은 자체 크기 그대로 사용한다).
──────────────────────────────────────────────────────────── */
export const ROOM = { w: 8, h: 3, d: 5 };

// 개요 씬에서 모델 로드 실패 시(placeholder만 있을 때) 축사 이름표를 띄울 높이 (m)
export const BARN_LABEL_HEIGHT = 3.2;

/* ────────────────────────────────────────────────────────────
   실측 모델(assets/models/p1.glb)

   방 3개(P1, P1.001, P1.002)가 서로 붙어있는 하나의 건물로 모델링되어
   있고, 작은 방부터 순서대로 이름이 붙어있다. 3개를 따로 떼어 멀리
   배치하지 않고, 파일에 들어있는 그대로(서로 붙은 채) 한 덩어리로
   씬에 올린 뒤, 그 안의 각 방 노드를 축사 A/B/C의 클릭 영역으로 쓴다.
──────────────────────────────────────────────────────────── */
export const COMPLEX_MODEL_URL = "../assets/models/p1.glb";

// 모델 로드에 실패했을 때만 쓰는 placeholder 배치 (서로 떨어진 박스 3개)
export const FALLBACK_POSITIONS = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(16, 0, 0),
  new THREE.Vector3(34, 0, 0),
];

/* ────────────────────────────────────────────────────────────
   축사 3개 설정 (실제로는 서버/CMS에서 가져올 목록)

   modelNodeName: COMPLEX_MODEL_URL 안에서 이 축사에 해당하는 노드 이름.
   해당 노드를 찾지 못하거나 모델 로드가 실패하면 FALLBACK_POSITIONS
   순서대로 와이어프레임 박스(placeholder)로 대체된다.
──────────────────────────────────────────────────────────── */
export const BARNS = [
  {
    id: 0,
    name: "자돈사 A동",
    ach: 20,
    supplyTemp: 30,
    humidity: 62,
    seed: 0.0,
    modelNodeName: "P1", // 가장 작은 방
  },
  {
    id: 1,
    name: "자돈사 B동",
    ach: 15,
    supplyTemp: 28,
    humidity: 58,
    seed: 1.7,
    modelNodeName: "P1.001", // 중간 크기 방
  },
  {
    id: 2,
    name: "자돈사 C동",
    ach: 25,
    supplyTemp: 31,
    humidity: 65,
    seed: 3.3,
    modelNodeName: "P1.002", // 가장 큰 방
  },
];
