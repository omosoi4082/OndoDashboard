import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { computeCameraFrame } from './cameraFraming.js';

describe('computeCameraFrame', () => {
  it('박스 중심을 기준으로 marginFactor만큼 떨어진 위치를 계산한다', () => {
    const box = new Box3(new Vector3(0, 0, 0), new Vector3(2, 2, 2));
    const frame = computeCameraFrame(box, 1);
    // center=(1,1,1), maxDim=2, dist=2
    expect(frame.target.toArray()).toEqual([1, 1, 1]);
    expect(frame.position.x).toBeCloseTo(1 + 2 * 0.433);
    expect(frame.position.y).toBeCloseTo(1 + 2 * 0.379);
    expect(frame.position.z).toBeCloseTo(1 + 2 * 0.462);
  });

  it('rotationCenter를 주면 target만 그 지점으로 옮기고 거리는 box 크기 기준 유지', () => {
    const box = new Box3(new Vector3(0, 0, 0), new Vector3(4, 4, 4));
    const rotationCenter = new Vector3(1, 1, 1);
    const frame = computeCameraFrame(box, 1, rotationCenter);
    expect(frame.target.toArray()).toEqual([1, 1, 1]);
    // maxDim=4, dist=4 (box 크기 기준, rotationCenter와 무관)
    expect(frame.position.x).toBeCloseTo(1 + 4 * 0.433);
  });

  it('direction을 주면 메인 화면 전용 각도로 독립적으로 계산한다(상세 패널 기본값과 분리)', () => {
    const box = new Box3(new Vector3(0, 0, 0), new Vector3(2, 2, 2));
    const frame = computeCameraFrame(box, 1, undefined, [0.24, 0.18, 0.18]);
    expect(frame.position.x).toBeCloseTo(1 + 2 * 0.24);
    expect(frame.position.y).toBeCloseTo(1 + 2 * 0.18);
    expect(frame.position.z).toBeCloseTo(1 + 2 * 0.18);
  });

  it('near/far는 거리에 비례한다', () => {
    const box = new Box3(new Vector3(0, 0, 0), new Vector3(10, 10, 10));
    const frame = computeCameraFrame(box, 2);
    expect(frame.near).toBeGreaterThan(0);
    expect(frame.far).toBeGreaterThan(frame.near);
  });
});
