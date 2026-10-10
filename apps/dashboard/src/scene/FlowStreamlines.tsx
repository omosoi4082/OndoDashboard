// 유동 흐름선(05-open-questions.md #40) — 급기구에서 출발해 flowGrid 속도장을 따라간
// 경로(detail/flowStreamline.ts)를 실린더를 이어붙여서 그린다. FlowCylinders.tsx(기존
// flowGrid 노드별 독립 실린더 방식)는 그대로 둔 채 별도 컴포넌트로 추가했다 — 온도 측
// 확인 후 어느 쪽을 쓸지 정해지면 FLOW_VISUALIZATION_MODE(config/constants.ts)로 전환한다.
// 세그먼트 전부 InstancedMesh 하나로 그리고(CLAUDE.md 규칙), 프레임마다 실제 쓰는 세그먼트
// 수가 달라지는 건 남는 인스턴스를 스케일 0으로 숨겨서 처리한다(마운트 때 할당한 최대
// 개수 = 시드 수 × maxSteps는 고정이라 재생성 안 함, FlowCylinders와 같은 성능 원칙).
import { useLayoutEffect, useMemo, useRef, type ReactElement } from 'react';
import * as THREE from 'three';
import type { DetailFrame, Geometry, MinMax } from '@ondo/shared';
import { zUpToYUp } from './coords.js';
import { valueToRGB01 } from '../detail/colormap.js';
import {
  DEFAULT_STREAMLINE_OPTIONS,
  allInletSeeds,
  sampleFlowVelocity,
  traceStreamline,
  type Vec3,
} from '../detail/flowStreamline.js';
import { FLOW_CYLINDER_RADIUS_M } from '../config/constants.js';

interface FlowStreamlinesProps {
  geometry: Geometry;
  frame: DetailFrame;
  range: MinMax;
}

const UP = new THREE.Vector3(0, 1, 0);
const ZERO_SCALE = new THREE.Vector3(0, 0, 0);
const IDENTITY_QUAT = new THREE.Quaternion();
const ORIGIN = new THREE.Vector3(0, 0, 0);

export function FlowStreamlines({ geometry, frame, range }: FlowStreamlinesProps): ReactElement {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // 시드(= 급기구 위치 기준)는 geometry만으로 정해지는 고정값 — 프레임이 바뀌어도 안 바뀐다.
  const seeds = useMemo(
    () => allInletSeeds(geometry.room.inlets, DEFAULT_STREAMLINE_OPTIONS.seedsPerInlet),
    [geometry],
  );
  const maxSegments = seeds.length * DEFAULT_STREAMLINE_OPTIONS.maxSteps;

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    const mid = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const color = new THREE.Color();

    const paths = seeds.map((seed) => traceStreamline(geometry.flowGrid, frame.flow, seed, geometry.room.size));

    let instanceIdx = 0;
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i += 1) {
        const a = path[i] as Vec3;
        const b = path[i + 1] as Vec3;

        const [x1, y1, z1] = zUpToYUp(a);
        const [x2, y2, z2] = zUpToYUp(b);
        from.set(x1, y1, z1);
        to.set(x2, y2, z2);

        const length = from.distanceTo(to);
        mid.copy(from).add(to).multiplyScalar(0.5);
        dir.subVectors(to, from).normalize();
        quaternion.setFromUnitVectors(UP, dir);
        scale.set(1, length, 1);
        matrix.compose(mid, quaternion, scale);
        mesh.setMatrixAt(instanceIdx, matrix);

        // 구간 색 = 구간 중점에서 다시 보간한 유속 크기(value, 데이터 좌표계 기준) —
        // flowGrid 노드별 실린더(FlowCylinders.tsx)와 같은 컬러맵·range를 쓴다.
        const midData: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
        const value = sampleFlowVelocity(geometry.flowGrid, frame.flow, midData)[3];
        const [r, g, bCol] = valueToRGB01(value, range.min, range.max);
        mesh.setColorAt(instanceIdx, color.setRGB(r, g, bCol));

        instanceIdx += 1;
      }
    }

    // 안 쓴 나머지 인스턴스는 스케일 0으로 숨긴다.
    for (; instanceIdx < maxSegments; instanceIdx += 1) {
      matrix.compose(ORIGIN, IDENTITY_QUAT, ZERO_SCALE);
      mesh.setMatrixAt(instanceIdx, matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [geometry, frame, range, seeds, maxSegments]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, maxSegments]}>
      {/* height=1 — 실제 길이는 인스턴스 스케일(scale.y)로만 조절한다(지오메트리는 고정). */}
      <cylinderGeometry args={[FLOW_CYLINDER_RADIUS_M, FLOW_CYLINDER_RADIUS_M, 1, 8]} />
      <meshStandardMaterial vertexColors roughness={0.4} metalness={0.1} />
    </instancedMesh>
  );
}
