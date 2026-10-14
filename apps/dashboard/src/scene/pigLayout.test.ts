import { describe, expect, it } from 'vitest';
import { pigAreaFromBox, planPigSlots } from './pigLayout.js';

describe('planPigSlots', () => {
  it('요청한 개수만큼 배치한다', () => {
    expect(planPigSlots(19, { minX: -2, maxX: 2, minZ: 0, maxZ: 7.4 })).toHaveLength(19);
  });

  it('모든 자리가 영역 안에 들어온다', () => {
    const area = { minX: -2, maxX: 2, minZ: -6, maxZ: 6 };
    for (const slot of planPigSlots(19, area)) {
      expect(slot.x).toBeGreaterThan(area.minX);
      expect(slot.x).toBeLessThan(area.maxX);
      expect(slot.z).toBeGreaterThan(area.minZ);
      expect(slot.z).toBeLessThan(area.maxZ);
    }
  });

  it('가로가 좁고 세로가 긴 방이면 열보다 줄이 많다(한 줄로 늘어서지 않는다)', () => {
    const slots = planPigSlots(19, { minX: -2, maxX: 2, minZ: -6, maxZ: 6 });
    const cols = new Set(slots.map((s) => s.x.toFixed(4))).size;
    const rows = new Set(slots.map((s) => s.z.toFixed(4))).size;
    expect(cols).toBeGreaterThan(1);
    expect(rows).toBeGreaterThan(cols);
  });

  it('칸 간격이 1.8배 돼지(0.86×1.06 m)보다 넓다 — 겹치지 않는다', () => {
    // 비육방 안쪽 영역(약 3.5×11.3 m)에 19두.
    const slots = planPigSlots(19, { minX: -1.75, maxX: 1.75, minZ: -11.75, maxZ: -0.45 });
    const xs = [...new Set(slots.map((s) => s.x))].sort((a, b) => a - b);
    const zs = [...new Set(slots.map((s) => s.z))].sort((a, b) => a - b);
    expect((xs[1] ?? 0) - (xs[0] ?? 0)).toBeGreaterThan(0.86);
    expect((zs[1] ?? 0) - (zs[0] ?? 0)).toBeGreaterThan(1.06);
  });

  it('개수가 0 이하이거나 영역이 비면 빈 배열', () => {
    expect(planPigSlots(0, { minX: 0, maxX: 1, minZ: 0, maxZ: 1 })).toEqual([]);
    expect(planPigSlots(5, { minX: 0, maxX: 0, minZ: 0, maxZ: 1 })).toEqual([]);
  });
});

describe('pigAreaFromBox', () => {
  it('벽에서 margin만큼 안쪽으로 좁힌다', () => {
    const area = pigAreaFromBox({ x: 0, z: 10 }, { x: 4, z: 6 }, 0.35);
    expect(area.minX).toBeCloseTo(-1.65, 5);
    expect(area.maxX).toBeCloseTo(1.65, 5);
    expect(area.minZ).toBeCloseTo(7.35, 5);
    expect(area.maxZ).toBeCloseTo(12.65, 5);
  });

  it('방이 margin보다 좁으면 중앙 한 점으로 수렴한다(음수 영역을 만들지 않는다)', () => {
    const area = pigAreaFromBox({ x: 0, z: 0 }, { x: 0.2, z: 0.2 }, 0.35);
    expect(area.minX).toBe(0);
    expect(area.maxX).toBe(0);
  });
});
