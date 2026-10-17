// 예측·전문가·제어 모드 유동 표현(01-functional-spec.md 3장) — flowGrid 노드마다 화살표
// 1개, 방향 [vx,vy,vz]·길이·색상 value(m/s). 2026-10-13 온도 측 A-3 확정 방식이다
// ("288개 점의 화살표... 방향은 (vx, vy, vz), 길이와 색은 value로 그리고, 프레임이 바뀔
// 때마다 화살표를 갱신").
//
// 화살표 = 몸통(실린더) + 머리(원뿔). 둘을 하나의 지오메트리로 합치지 않고 InstancedMesh를
// 각각 하나씩 둔다(총 2개, 288×2 인스턴스) — 합쳐 두면 몸통을 길이에 맞춰 늘릴 때 머리까지
// 같이 늘어나 값이 큰 화살표의 머리만 과장돼 보인다. 어느 쪽이든 노드마다 mesh를 만들지
// 않는다는 CLAUDE.md 규칙은 지킨다.
//
// 프레임(타임라인) 전환 시 instanceMatrix·instanceColor 버퍼만 갱신하고 지오메트리·
// InstancedMesh 자체는 재생성하지 않는다(docs/04-tasks.md M5 성능 요구).
//
// 파일 이름은 'FlowCylinders'로 두고 있다 —
// 정리할 예정이라 그때 같이 바꾼다(docs/04-tasks.md "보류" 항목).
import { useLayoutEffect, useMemo, useRef, type ReactElement } from 'react';
import * as THREE from 'three';
import type { DetailFrame, Geometry, MinMax } from '@ondo/shared';
import { zUpToYUp } from './coords.js';
import { valueToRGB01 } from '../detail/colormap.js';
import { flowNodeCount, flowNodePosition } from '../detail/flowNodes.js';
import { withNeutralVertexColors } from './instancedColorFix.js';
import {
  FLOW_ARROW_HEAD_LENGTH_M,
  FLOW_ARROW_HEAD_RADIUS_M,
  FLOW_CYLINDER_MAX_LENGTH_M,
  FLOW_CYLINDER_MIN_LENGTH_M,
  FLOW_CYLINDER_RADIUS_M,
} from '../config/constants.js';

interface FlowCylindersProps {
  geometry: Geometry;
  frame: DetailFrame;
  range: MinMax;
}

const UP = new THREE.Vector3(0, 1, 0);

export function FlowCylinders({ geometry, frame, range }: FlowCylindersProps): ReactElement {
  const shaftRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const count = flowNodeCount(geometry.flowGrid);
  // withNeutralVertexColors: instanceColor가 검게 렌더링되는 환경 문제를 피하기 위한 것
  // (instancedColorFix.ts 참고).
  const shaftGeom = useMemo(
    () => withNeutralVertexColors(new THREE.CylinderGeometry(FLOW_CYLINDER_RADIUS_M, FLOW_CYLINDER_RADIUS_M, 1, 8)),
    [],
  );
  const headGeom = useMemo(
    () => withNeutralVertexColors(new THREE.ConeGeometry(FLOW_ARROW_HEAD_RADIUS_M, FLOW_ARROW_HEAD_LENGTH_M, 8)),
    [],
  );

  useLayoutEffect(() => {
    const shaft = shaftRef.current;
    const head = headRef.current;
    if (!shaft || !head) return;

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    const headPosition = new THREE.Vector3();
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

      // 몸통: 노드 위치를 중심으로 길이 length만큼(지오메트리 height=1을 scale.y로 늘린다).
      scale.set(1, length, 1);
      matrix.compose(position, quaternion, scale);
      shaft.setMatrixAt(idx, matrix);

      // 머리: 몸통의 +dir 쪽 끝(노드에서 length/2)에 원뿔 밑면이 오도록, 원뿔 자체의
      // 절반 길이만큼 더 밀어 놓는다. 크기는 스케일하지 않는다(위 주석).
      const headOffset = length / 2 + FLOW_ARROW_HEAD_LENGTH_M / 2;
      headPosition.copy(dir).multiplyScalar(headOffset).add(position);
      scale.set(1, 1, 1);
      matrix.compose(headPosition, quaternion, scale);
      head.setMatrixAt(idx, matrix);

      const [r, g, b] = valueToRGB01(value, range.min, range.max, 'flow');
      color.setRGB(r, g, b);
      shaft.setColorAt(idx, color);
      head.setColorAt(idx, color);
    }

    shaft.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    if (shaft.instanceColor) shaft.instanceColor.needsUpdate = true;
    if (head.instanceColor) head.instanceColor.needsUpdate = true;
  }, [geometry, frame, range, count]);

  // toneMapped=false: R3F 기본 ACESFilmic 톤매핑이 채도 높은 색을 바래 보이게 만든다
  // (PointsInstanced.tsx와 같은 이유, 2026-10-10 확인).
  return (
    <>
      <instancedMesh ref={shaftRef} args={[undefined, undefined, count]}>
        {/* height=1 — 실제 길이는 인스턴스 스케일(scale.y)로만 조절한다(지오메트리는 고정). */}
        <primitive object={shaftGeom} attach="geometry" />
        <meshStandardMaterial vertexColors roughness={0.4} metalness={0.1} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, count]}>
        <primitive object={headGeom} attach="geometry" />
        <meshStandardMaterial vertexColors roughness={0.4} metalness={0.1} toneMapped={false} />
      </instancedMesh>
    </>
  );
}
