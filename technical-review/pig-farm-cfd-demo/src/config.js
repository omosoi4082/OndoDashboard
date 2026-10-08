import * as THREE from "three";

/* ────────────────────────────────────────────────────────────
   공용 상수: 방(축사 내부) 크기 — 상세(detail) 씬의 합성 CFD 볼륨/
   스트림라인 계산에 쓰이는 방 치수.
   실제 자돈사 모델(p1.glb, P1 방)의 실측 치수를 그대로 썼다 — 예전엔
   8×3×5짜리 예시용 가상 치수였는데, 그거에 맞춰 모델을 늘려 넣었더니
   비율이 옆으로 찌그러져 보였다. 지금은 반대로, 이 값 자체를 실측 모델
   크기로 맞춰서 모델을 왜곡 없이 그대로 쓰고 데이터 쪽을 거기 맞춘다.
──────────────────────────────────────────────────────────── */
export const ROOM = { w: 4.7, h: 2.8, d: 4.2 };

// 개요 씬에서 모델 로드 실패 시(placeholder만 있을 때) 축사 이름표를 띄울 높이 (m)
export const BARN_LABEL_HEIGHT = 3.2;

/* ────────────────────────────────────────────────────────────
   실측 모델(assets/models/p1.glb)

   방 3개(P1, P1.001, P1.002)가 서로 붙어있는 하나의 건물로 모델링되어
   있고, 작은 방부터 순서대로 이름이 붙어있다. 3개를 따로 떼어 멀리
   배치하지 않고, 파일에 들어있는 그대로(서로 붙은 채) 한 덩어리로
   씬에 올린 뒤, 그 안의 각 방 노드를 축사 A/B/C의 클릭 영역으로 쓴다.
──────────────────────────────────────────────────────────── */
// 끝의 ?v=N은 캐시 무력화용 — 모델(p1.glb)을 새로 내보낼 때마다 숫자를 올려서
// 브라우저/서버가 예전 파일을 계속 캐시해서 보여주는 문제를 막는다.
// 상세보기(detailScene.js)는 계속 이 모델을 그대로 쓴다.
export const COMPLEX_MODEL_URL = "../assets/models/p1.glb?v=17";

// 메인 화면(overviewScene.js) 전용 모델 — 자돈·육성·비육 3개 방이 한 파일에 통합된
// 실측 모델(2026-10-08 교체본)로 바뀌었다. 이전 weaner_room_test.glb(자돈 1개 방뿐)와
// 달리, 자돈(P1)은 예전처럼 단일 루트 노드지만 육성/비육은 Blender에서 하나의 빈(empty)
// 으로 묶이지 않고 "Grower_"/"Finisher_" 접두사가 붙은 낱개 노드들로만 구성돼 있어
// BARNS에서 modelNodeName 대신 modelNodePrefix로 매칭한다(barnFactory.js 참고).
export const OVERVIEW_MODEL_URL = "../assets/models/weaner_room_test-001.glb?v=1";

// 모델 로드에 실패했을 때만 쓰는 placeholder 배치 (서로 떨어진 박스 3개)
export const FALLBACK_POSITIONS = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(16, 0, 0),
  new THREE.Vector3(34, 0, 0),
];

/* ────────────────────────────────────────────────────────────
   축사 3개 설정 (실제로는 서버/CMS에서 가져올 목록)

   modelNodeName: 노드 이름 "정확히 일치"로 찾는다(자돈/P1처럼 방 전체가 노드 하나).
   modelNodePrefix: 이 접두사로 시작하는 노드를 전부 찾아 하나의 축사로 묶는다
   (육성/비육처럼 방이 여러 낱개 노드로만 구성된 경우). 해당 노드를 찾지 못하거나
   모델 로드가 실패하면 FALLBACK_POSITIONS 순서대로 와이어프레임 박스(placeholder)로
   대체된다.

   육성·비육은 모델 자체가 이미 벽·팬·가림막 전부 단일 회색 재질(PigRoom_Gray)로
   만들어져 있어(자돈방만 콘크리트·크림·분홍 등으로 세부 재질이 다양함) 코드에서
   따로 회색 처리를 하지 않는다 — 원본 재질 그대로 쓰는 것이 실험군(EX) 자돈방만
   상세 패널 대상이라는 화면 설계 규칙과도 맞는다. 상세 패널은 항상 자돈방(id 0)만
   보여준다(main.js, 클릭 인터랙션 없음) — 육성·비육은 ach/supplyTemp/humidity/seed
   같은 상세용 합성 CFD 필드가 필요 없다.
──────────────────────────────────────────────────────────── */
export const BARNS = [
  {
    id: 0,
    name: "자돈방",
    ach: 20,
    supplyTemp: 30,
    humidity: 62,
    seed: 0.0,
    modelNodeName: "P1", // 자돈(Weaner) 방 — 유일하게 상세 패널에서 쓰인다
  },
  {
    id: 1,
    name: "육성돈방",
    modelNodePrefix: "Grower_",
  },
  {
    id: 2,
    name: "비육돈방",
    modelNodePrefix: "Finisher_",
  },
];
