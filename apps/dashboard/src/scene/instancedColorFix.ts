// InstancedMesh + meshBasicMaterial(vertexColors) 조합에서, geometry에 일반 정점
// color 속성이 하나도 없으면 instanceColor가 전혀 안 먹고 전부 검게 렌더링되는 환경이
// 있었다(2026-10-10 확인 — PointsInstanced/FlowStreamlines/FlowCylinders 전부 동일 증상).
// instanceColor 버퍼 값 자체는 정상이었고(setColorAt 직후 읽어보면 올바른 RGB), material.
// needsUpdate만으로는 고쳐지지 않았으며, geometry에 중립(흰색) 정점 color 속성을 함께 두면
// (USE_COLOR + USE_INSTANCING_COLOR 둘 다 정의) 정상적으로 보였다 — GPU/드라이버의
// instancing-color-only 셰이더 경로 버그로 추정. 실제 색은 instanceColor가 그대로 곱해져
// 결정하므로(흰색 1,1,1을 곱하는 것뿐) 시각적 부작용은 없다.
import * as THREE from 'three';

export function withNeutralVertexColors<T extends THREE.BufferGeometry>(geometry: T): T {
  const vertexCount = geometry.attributes.position?.count ?? 0;
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertexCount * 3).fill(1), 3));
  return geometry;
}
