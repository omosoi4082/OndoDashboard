// 3D 단면 높이 표시 판 — 방 바깥에만 두르는 반투명 테(2026-10-28 사용자: "판을 보이는데 모델링 안으로는
// 안 보이고 밖에만 있고 반투명으로"). 온도 측 샘플 뷰어는 방 전체를 덮는 색 판을 썼지만, 우리는 방 안
// 입자·돼지를 가리지 않게 가운데를 비우고 색은 오른쪽 단면 그림에만 칠한다. 높이는 store sectionZ
// ("3D 자돈방" 줄 슬라이더)를 따른다.
import { useEffect, useMemo, type ReactElement } from 'react';
import * as THREE from 'three';
import { useDetailStore } from '../store/detailStore.js';
import {
  SECTION_PLANE_EDGE_OPACITY,
  SECTION_PLANE_MARGIN_M,
  SECTION_PLANE_OPACITY,
} from '../config/constants.js';

/** 방(데이터 좌표 길이 W × 폭 D)을 SECTION_PLANE_MARGIN_M만큼 둘러싼 테 — 바닥과 나란한 y = 0 평면. */
function buildRing(w: number, d: number): { fill: THREE.ShapeGeometry; edges: THREE.EdgesGeometry } {
  const m = SECTION_PLANE_MARGIN_M;
  const shape = new THREE.Shape();
  shape.moveTo(-m, -m);
  shape.lineTo(w + m, -m);
  shape.lineTo(w + m, d + m);
  shape.lineTo(-m, d + m);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(0, 0);
  hole.lineTo(0, d);
  hole.lineTo(w, d);
  hole.lineTo(w, 0);
  hole.closePath();
  shape.holes.push(hole);
  const fill = new THREE.ShapeGeometry(shape);
  // 모양의 (x, y) → Three (x, 0, −y): 데이터 y(폭 0~D)가 Three z −D~0이 된다(scene/coords.ts와 같은 방향).
  fill.rotateX(-Math.PI / 2);
  const edges = new THREE.EdgesGeometry(fill);
  return { fill, edges };
}

export function SectionPlane({ roomSize }: { roomSize: readonly [number, number, number] }): ReactElement {
  const sectionZ = useDetailStore((s) => s.sectionZ);
  const [w, d] = roomSize;
  const ring = useMemo(() => buildRing(w, d), [w, d]);

  useEffect(
    () => () => {
      ring.fill.dispose();
      ring.edges.dispose();
    },
    [ring],
  );

  return (
    <group position={[0, sectionZ, 0]}>
      {/* depthWrite false — 반투명 면이 뒤의 입자·모델을 지우지 않게(입자와 같은 방식). */}
      <mesh geometry={ring.fill} renderOrder={1}>
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={SECTION_PLANE_OPACITY}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={ring.edges} renderOrder={1}>
        <lineBasicMaterial color="#ffffff" transparent opacity={SECTION_PLANE_EDGE_OPACITY} depthWrite={false} />
      </lineSegments>
    </group>
  );
}
