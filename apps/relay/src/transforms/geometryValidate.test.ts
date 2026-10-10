import { describe, expect, it } from 'vitest';
import { validateGeometry } from './geometryValidate.js';

function validSample(): unknown {
  return {
    geometryId: 'pig-nh-v1',
    note: '여분 필드는 무시된다',
    room: {
      size: [4.5, 4.0, 2.8],
      inlets: [{ x: 2.25, y: 0.83, z: 2.8, w: 0.32, l: 0.687 }],
      outlet: { wall: 'y=0', x: 2.25, z: 1.6, d: 0.4 },
    },
    points: [{ id: 0, x: 0, y: 0, z: 0 }],
    grid: { origin: [0, 0, 0], spacing: [0.25, 0.25, 0.4], size: [19, 17, 8] },
    flowGrid: { origin: [0.25, 0.25, 0.35], spacing: [0.5, 0.5, 0.7], size: [9, 8, 4] },
  };
}

describe('validateGeometry', () => {
  it('유효한 형상이면 ok:true와 여분 필드가 제거된 데이터를 돌려준다', () => {
    const result = validateGeometry(validSample());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.geometryId).toBe('pig-nh-v1');
      expect(result.data).not.toHaveProperty('note');
    }
  });

  it('points가 비어 있으면 ok:false', () => {
    const sample = validSample() as Record<string, unknown>;
    sample.points = [];
    const result = validateGeometry(sample);
    expect(result.ok).toBe(false);
  });

  it('grid.size가 3개 숫자가 아니면 ok:false', () => {
    const sample = validSample() as { grid: Record<string, unknown> };
    sample.grid.size = [19, 17];
    const result = validateGeometry(sample);
    expect(result.ok).toBe(false);
  });

  it('필수 필드가 없으면 ok:false', () => {
    const result = validateGeometry({ geometryId: 'x' });
    expect(result.ok).toBe(false);
  });

  it('room.inlets·outlet은 걸러지지 않고 응답에 남는다(유동 흐름선 시작점, #40)', () => {
    const result = validateGeometry(validSample());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.room.inlets).toEqual([{ x: 2.25, y: 0.83, z: 2.8, w: 0.32, l: 0.687 }]);
      expect(result.data.room.outlet).toEqual({ wall: 'y=0', x: 2.25, z: 1.6, d: 0.4 });
    }
  });

  it('room.inlets가 비어 있으면 ok:false', () => {
    const sample = validSample() as { room: Record<string, unknown> };
    sample.room.inlets = [];
    const result = validateGeometry(sample);
    expect(result.ok).toBe(false);
  });
});
