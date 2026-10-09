// 예측·전문가·제어 모드 유동 표현(01-functional-spec.md 3장) — flowGrid 노드마다 실린더
// 1개, 방향 [vx,vy,vz]·길이·색상 value(m/s). 288개 전부 InstancedMesh 1개로 그린다
// (CLAUDE.md "포인트/인스턴스는 InstancedMesh로" 규칙 — 여기선 포인트가 아니라 유동
// 글리프지만 같은 원칙). 프레임(타임라인) 전환 시 instanceMatrix·instanceColor 버퍼만
// 갱신하고 지오메트리·InstancedMesh 자체는 재생성하지 않는다(docs/04-tasks.md M5 성능 요구).
import { useLayoutEffect, useRef, type ReactElement } from 'react';
import * as THREE from 'three';
import type { DetailFrame, Geometry, MinMax } from '@ondo/shared';
import { zUpToYUp } from './coords.js';
import { valueToRGB01 } from '../detail/colormap.js';
import { flowNodeCount, flowNodePosition } from '../detail/flowNodes.js';
import { FLOW_CYLINDER_MAX_LENGTH_M, FLOW_CYLINDER_MIN_LENGTH_M, FLOW_CYLINDER_RADIUS_M } from '../config/constants.js';

interface FlowCylindersProps {
  geometry: Geometry;
  frame: DetailFrame;
  range: MinMax;
}

const UP = new THREE.Vector3(0, 1, 0);

export function FlowCylinders({ geometry, frame, range }: FlowCylindersProps): ReactElement {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = flowNodeCount(geometry.flowGrid);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const color = new THREE.Color();
    const span = Math.max(range.max - range.min, 1e-6);

    for (let idx = 0; idx < count; idx += 1) {
      const dataPos = flowNodePosition(geometry.flowGrid, idx);
      const [x, y, z] = zUpToYUp(dataPos);
      position.set(x, y, z);

      const flow = frame.flow[idx];
      const vx = flow?.[0] ?? 0;
      const vy = flow?.[1] ?? 0;
      const vz = flow?.[2] ?? 0;
      const value = flow?.[3] ?? 0;

      const [dx, dy, dz] = zUpToYUp([vx, vy, vz]);
      dir.set(dx, dy, dz);
      if (dir.lengthSq() === 0) dir.copy(UP);
      else dir.normalize();
      quaternion.setFromUnitVectors(UP, dir);

      const t = Math.min(Math.max((value - range.min) / span, 0), 1);
      const length = FLOW_CYLINDER_MIN_LENGTH_M + t * (FLOW_CYLINDER_MAX_LENGTH_M - FLOW_CYLINDER_MIN_LENGTH_M);
      scale.set(1, length, 1);

      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(idx, matrix);

      const [r, g, b] = valueToRGB01(value, range.min, range.max);
      mesh.setColorAt(idx, color.setRGB(r, g, b));
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [geometry, frame, range, count]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      {/* height=1 — 실제 길이는 인스턴스 스케일(scale.y)로만 조절한다(지오메트리는 고정). */}
      <cylinderGeometry args={[FLOW_CYLINDER_RADIUS_M, FLOW_CYLINDER_RADIUS_M, 1, 8]} />
      <meshStandardMaterial vertexColors roughness={0.4} metalness={0.1} />
    </instancedMesh>
  );
}
