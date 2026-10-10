import { describe, expect, it } from 'vitest';
import { shouldRefetchGeometry } from './geometryCompare.js';
import type { Geometry } from '@ondo/shared';

function fakeGeometry(id: string): Geometry {
  return {
    geometryId: id,
    room: { size: [4.5, 4.0, 2.8], inlets: [{ x: 2.25, y: 0.83, z: 2.8, w: 0.32, l: 0.687 }], outlet: { wall: 'y=0', x: 2.25, z: 1.6, d: 0.4 } },
    points: [{ id: 0, x: 0, y: 0, z: 0 }],
    grid: { origin: [0, 0, 0], spacing: [0.25, 0.25, 0.4], size: [19, 17, 8] },
    flowGrid: { origin: [0.25, 0.25, 0.35], spacing: [0.5, 0.5, 0.7], size: [9, 8, 4] },
  };
}

describe('shouldRefetchGeometry', () => {
  it('보관 중인 geometry가 없으면 true', () => {
    expect(shouldRefetchGeometry(null, 'pig-nh-v1')).toBe(true);
  });

  it('geometryId가 같으면 false(재요청 안 함)', () => {
    expect(shouldRefetchGeometry(fakeGeometry('pig-nh-v1'), 'pig-nh-v1')).toBe(false);
  });

  it('geometryId가 다르면 true(재요청)', () => {
    expect(shouldRefetchGeometry(fakeGeometry('pig-nh-v1'), 'pig-nh-v2')).toBe(true);
  });
});
