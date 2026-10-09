// 상세 자돈방 3D 뷰(12·18·25·32)의 125개 포인트 — 전부 InstancedMesh 하나로 그린다
// (CLAUDE.md "3D 포인트 125개는 InstancedMesh로 그린다" 규칙). 색상은 값→컬러맵
// (detail/colormap.ts), 어떤 값을 쓸지는 pointSelection.ts에서 토글(유동/습도/온도)별로
// 고른다. 좌표 변환은 scene/coords.ts 한 곳에서만 처리한다. frame이 없으면(데이터 전·로딩·
// 오류) 위치는 geometry 고정값이라 그대로 그리고 색만 중립색으로 칠한다(01-functional-spec.md 3장).
import { useLayoutEffect, useMemo, useRef, type ReactElement } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { DetailBase, DetailFrame, Geometry } from '@ondo/shared';
import { zUpToYUp } from '../../scene/coords.js';
import type { ValueField } from '../../store/detailStore.js';
import { getFieldRange, getPointScalar } from '../../detail/pointSelection.js';
import { valueToRGB01 } from '../../detail/colormap.js';

const POINT_RADIUS_M = 0.04;
const NO_DATA_POINT_COLOR = new THREE.Color(0x8a94a6);

interface PointsInstancedProps {
  geometry: Geometry;
  frame: DetailFrame | null;
  range: DetailBase['range'] | null;
  valueField: ValueField;
  onHoverChange: (pointId: number | null) => void;
}

export function PointsInstanced({ geometry, frame, range, valueField, onHoverChange }: PointsInstancedProps): ReactElement {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = geometry.points.length;
  const fieldRange = useMemo(() => (range ? getFieldRange(range, valueField) : null), [range, valueField]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const color = new THREE.Color();

    geometry.points.forEach((p, i) => {
      const [x, y, z] = zUpToYUp([p.x, p.y, p.z]);
      matrix.compose(new THREE.Vector3(x, y, z), quaternion, scale);
      mesh.setMatrixAt(i, matrix);

      if (!frame || !fieldRange) {
        mesh.setColorAt(i, NO_DATA_POINT_COLOR);
        return;
      }
      const value = getPointScalar(frame, valueField, p.id);
      const [r, g, b] = valueToRGB01(value, fieldRange.min, fieldRange.max);
      mesh.setColorAt(i, color.setRGB(r, g, b));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [geometry, frame, valueField, fieldRange]);

  const handlePointerMove = (e: ThreeEvent<PointerEvent>): void => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    const point = geometry.points[e.instanceId];
    onHoverChange(point ? point.id : null);
  };
  const handlePointerOut = (e: ThreeEvent<PointerEvent>): void => {
    e.stopPropagation();
    onHoverChange(null);
  };

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
    >
      <sphereGeometry args={[POINT_RADIUS_M, 12, 12]} />
      <meshStandardMaterial vertexColors roughness={0.5} metalness={0.05} />
    </instancedMesh>
  );
}
