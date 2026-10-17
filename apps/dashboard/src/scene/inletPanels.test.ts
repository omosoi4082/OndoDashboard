import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { RoomInlet } from '@ondo/shared';
import {
  INLET_PANEL_THICKNESS_M,
  buildInletPanels,
  inletFaceMaterials,
  inletPanelTransform,
} from './inletPanels.js';

// config/geometry.json의 실제 급기구 3개(온도 측 2026-10-08 v2 제공).
const INLETS: RoomInlet[] = [
  { x: 2.25, y: 0.83, z: 2.8, w: 0.32, l: 0.687 },
  { x: 2.25, y: 2.0, z: 2.8, w: 0.32, l: 0.687 },
  { x: 2.25, y: 3.17, z: 2.8, w: 0.32, l: 0.687 },
];

describe('inletPanelTransform', () => {
  it('데이터 좌표를 Three.js(y-up)로 옮긴다 — y는 높이, 데이터 y는 −z', () => {
    const { position } = inletPanelTransform(INLETS[0]!, 0.03);
    expect(position[0]).toBeCloseTo(2.25, 6); // x 그대로
    expect(position[2]).toBeCloseTo(-0.83, 6); // 데이터 y 0.83 → z −0.83
  });

  it('판 윗면이 천장(z=2.8)과 같은 높이가 되도록 두께의 절반만큼 내린다', () => {
    const t = 0.03;
    const { position, size } = inletPanelTransform(INLETS[0]!, t);
    expect(position[1]).toBeCloseTo(2.8 - t / 2, 6);
    // 중심 + 두께/2 = 천장
    expect(position[1] + size[1] / 2).toBeCloseTo(2.8, 6);
  });

  it('w는 x, l은 z(데이터 y) 크기다 — p1.glb IN*_Grille 실측과 같은 방향', () => {
    const { size } = inletPanelTransform(INLETS[0]!, 0.03);
    expect(size[0]).toBeCloseTo(0.32, 6);
    expect(size[2]).toBeCloseTo(0.687, 6);
  });

  it('두께를 생략하면 기본값을 쓴다', () => {
    expect(inletPanelTransform(INLETS[0]!).size[1]).toBe(INLET_PANEL_THICKNESS_M);
  });

  it('급기구 3개가 데이터 y를 따라 떨어져 배치된다(겹치지 않는다)', () => {
    const zs = INLETS.map((i) => inletPanelTransform(i).position[2]);
    expect(zs).toEqual([-0.83, -2.0, -3.17]);
    const halfL = 0.687 / 2;
    for (let i = 1; i < zs.length; i += 1) {
      expect(Math.abs(zs[i]! - zs[i - 1]!)).toBeGreaterThan(halfL * 2);
    }
  });
});

describe('inletFaceMaterials', () => {
  it('BoxGeometry 면 순서 [+x,-x,+y,-y,+z,-z] 중 위·아래만 필터 텍스처', () => {
    const face = new THREE.MeshStandardMaterial({ name: 'face' });
    const edge = new THREE.MeshStandardMaterial({ name: 'edge' });
    const mats = inletFaceMaterials({ face, edge });
    expect(mats).toHaveLength(6);
    expect(mats[2]).toBe(face); // +y 위
    expect(mats[3]).toBe(face); // -y 아래
    expect([mats[0], mats[1], mats[4], mats[5]]).toEqual([edge, edge, edge, edge]);
  });
});

describe('buildInletPanels', () => {
  it('급기구 수만큼 메쉬를 만든다', () => {
    const group = buildInletPanels(INLETS, {
      face: new THREE.MeshStandardMaterial(),
      edge: new THREE.MeshStandardMaterial(),
    });
    expect(group.children).toHaveLength(3);
    expect(group.children.every((c) => c instanceof THREE.Mesh)).toBe(true);
  });

  it('급기구가 없으면 빈 그룹 — 개수를 하드코딩하지 않는다(CLAUDE.md)', () => {
    const group = buildInletPanels([], {
      face: new THREE.MeshStandardMaterial(),
      edge: new THREE.MeshStandardMaterial(),
    });
    expect(group.children).toHaveLength(0);
  });

  it('메쉬 위치가 inletPanelTransform과 일치한다', () => {
    const group = buildInletPanels(INLETS, {
      face: new THREE.MeshStandardMaterial(),
      edge: new THREE.MeshStandardMaterial(),
    });
    const expected = inletPanelTransform(INLETS[1]!);
    const mesh = group.children[1] as THREE.Mesh;
    expect(mesh.position.toArray()).toEqual(expected.position);
  });
});
