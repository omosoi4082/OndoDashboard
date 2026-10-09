// 유동 토글 선택 시 호버 포인트의 방향 화살표(01-functional-spec.md 3장: "유동 선택 시
// 유동 방향 화살표를 함께 표시"). technical-review/pig-farm-cfd-demo의 유동 표현은
// flowGrid 288개 스트림라인(M5 범위, docs/07-starter-kit-assets.md streamlines.js)이라
// 여기서는 방향 벡터 계산 방식만 참고하고, 호버 포인트 1개짜리 단일 화살표로 단순화했다.
// 좌표/방향 변환은 scene/coords.ts의 zUpToYUp 재사용(방향 벡터도 축만 바뀌는 성분 교환이라
// 그대로 적용 가능).
import { useMemo, type ReactElement } from 'react';
import * as THREE from 'three';
import type { FlowVec, MinMax } from '@ondo/shared';
import { zUpToYUp } from '../../scene/coords.js';

interface FlowArrowProps {
  origin: { x: number; y: number; z: number };
  flow: FlowVec;
  range: MinMax;
}

const MIN_LENGTH_M = 0.08;
const MAX_LENGTH_M = 0.45;
const ARROW_COLOR = 0xffffff;

export function FlowArrow({ origin, flow, range }: FlowArrowProps): ReactElement | null {
  const [vx, vy, vz, value] = flow;

  const transform = useMemo(() => {
    const dir = new THREE.Vector3(...zUpToYUp([vx, vy, vz]));
    if (dir.lengthSq() === 0) return null;
    dir.normalize();

    const span = Math.max(range.max - range.min, 1e-6);
    const t = Math.min(Math.max((value - range.min) / span, 0), 1);
    const length = MIN_LENGTH_M + t * (MAX_LENGTH_M - MIN_LENGTH_M);
    // 실린더·원뿔의 기본 긴 축(three-y)을 유동 방향으로 맞춘다(PigInstances.tsx와
    // 같은 쿼터니언 기법).
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return { quaternion, length };
  }, [vx, vy, vz, value, range]);

  if (!transform) return null;

  const position = zUpToYUp([origin.x, origin.y, origin.z]);

  return (
    <group position={position} quaternion={transform.quaternion}>
      <mesh position={[0, transform.length / 2, 0]}>
        <cylinderGeometry args={[0.012, 0.012, transform.length, 8]} />
        <meshBasicMaterial color={ARROW_COLOR} />
      </mesh>
      <mesh position={[0, transform.length, 0]}>
        <coneGeometry args={[0.03, 0.08, 10]} />
        <meshBasicMaterial color={ARROW_COLOR} />
      </mesh>
    </group>
  );
}
