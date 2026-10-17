// 급기구를 천장면의 얇은 판으로 그린다 (2026-10-13 온도 측 B-6).
//
// 요청: "천장에 매달린 직육면체가 아니라 **천장면의 2D 사각형**(0.32 × 0.687 m)".
// p1.glb에는 팬 하우징이 통째로 들어 있어(`IN1~IN3_FanSimple`: Grille/Housing/OuterLouver/
// ScreenBar/ScreenFrame) 천장 아래로 0.6 m쯤 튀어나와 보였다. 그 노드들을 숨기고
// 여기서 만든 얇은 판으로 대체한다.
//
// 2026-10-17 사용자 지시대로 **완전한 평면이 아니라 아주 얇은 육면체**로 만들고 필터 텍스처를
// 위·아래 두 면에 붙인다. 평면(PlaneGeometry) 한 장이면 옆에서 볼 때 종잇장처럼 사라지고
// 뒷면이 비치는데, 얇은 판은 천장에 끼운 필터처럼 두께가 보여 더 자연스럽다.
//
// 좌표: geometry.room.inlets는 데이터 좌표(z-up)라 scene/coords.ts의 zUpToYUp을 거친다
// (CLAUDE.md "좌표 변환은 coords.ts 한 곳에서만").
import * as THREE from 'three';
import type { RoomInlet } from '@ondo/shared';
import { zUpToYUp } from './coords.js';
import {
  DETAIL_TEXTURES,
  TEXTURE_TILE_M,
  createTextureLoaderIfSupported,
  loadTextureSet,
  repeatsForSize,
  withRepeat,
} from './detailRoomTextures.js';

/** 판 두께(m). 천장 두께 안에 들어가 보이도록 얇게. */
export const INLET_PANEL_THICKNESS_M = 0.03;

/** p1.glb에서 숨길 입체 급기구 노드(각각 Grille·Housing·Louver·ScreenBar·ScreenFrame을 품은 그룹). */
export const INLET_MODEL_NODE_NAMES = ['IN1_FanSimple', 'IN2_FanSimple', 'IN3_FanSimple'] as const;

export interface InletPanelTransform {
  /** Three.js(y-up) 중심 좌표. */
  position: [number, number, number];
  /** Three.js 크기 [x, y(두께), z]. */
  size: [number, number, number];
}

/**
 * 급기구 하나 → 얇은 판의 위치·크기.
 *
 * `w`는 x 방향, `l`은 데이터 y 방향 크기다(p1.glb의 `IN*_Grille` 실측으로 확인 —
 * 로컬 x 2.094~2.406 = 0.312 ≈ w 0.32, z −1.172~−0.485 = 0.687 = l).
 * 천장 높이 z에 중심을 두면 판의 절반이 천장 위로 솟으므로, **판 윗면이 천장과 같은 높이**가
 * 되도록 두께의 절반만큼 내린다.
 */
export function inletPanelTransform(
  inlet: RoomInlet,
  thickness: number = INLET_PANEL_THICKNESS_M,
): InletPanelTransform {
  const [x, yUp, z] = zUpToYUp([inlet.x, inlet.y, inlet.z]);
  return {
    position: [x, yUp - thickness / 2, z],
    size: [inlet.w, thickness, inlet.l],
  };
}

export interface InletPanelMaterials {
  /** 위·아래 면 — 필터망 텍스처. */
  face: THREE.Material;
  /** 옆 네 면 — 판 테두리. */
  edge: THREE.Material;
}

/**
 * BoxGeometry의 면 순서는 [+x, -x, +y, -y, +z, -z]다. 위(+y)·아래(-y)만 필터 텍스처를 주고
 * 나머지 네 면은 테두리 재질로 둔다 — 사용자 지시 "텍스처 위아래로 붙이면 될 것 같은데".
 */
export function inletFaceMaterials(materials: InletPanelMaterials): THREE.Material[] {
  const { face, edge } = materials;
  return [edge, edge, face, face, edge, edge];
}

/** 급기구 판 3개를 담은 그룹. 방 좌표계(Three.js y-up)에 그대로 놓는다. */
export function buildInletPanels(
  inlets: readonly RoomInlet[],
  materials: InletPanelMaterials,
  thickness: number = INLET_PANEL_THICKNESS_M,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'InletPanels';

  for (const [i, inlet] of inlets.entries()) {
    const { position, size } = inletPanelTransform(inlet, thickness);
    const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const mesh = new THREE.Mesh(geometry, inletFaceMaterials(materials));
    mesh.position.set(position[0], position[1], position[2]);
    mesh.name = `InletPanel_${i + 1}`;
    mesh.castShadow = false; // 천장에 붙은 얇은 판이라 그림자를 드리울 두께가 없다
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

/** p1.glb 안의 입체 급기구(팬 하우징)를 숨긴다 — 얇은 판으로 대체하므로. */
export function hideModelInlets(model: THREE.Object3D): void {
  for (const name of INLET_MODEL_NODE_NAMES) {
    const node = model.getObjectByName(name);
    if (node) node.visible = false;
  }
}

/**
 * 필터 텍스처를 입힌 급기구 판 재질. 텍스처 로드는 비싸므로 모듈 1회만 만든다.
 * 판이 작아(0.32 × 0.687 m) 타일을 잘게 반복해야 필터 눈이 성기게 보이지 않는다.
 */
function createInletMaterials(inlet: RoomInlet): InletPanelMaterials {
  // 브라우저가 아니면(vitest) 텍스처 없이 단색 재질 — detailRoomModel.applyRoomTextures와 같은 이유.
  const loader = createTextureLoaderIfSupported();
  const maps =
    loader === null
      ? null
      : withRepeat(
          loadTextureSet(loader, DETAIL_TEXTURES.inlet),
          repeatsForSize(inlet.w, TEXTURE_TILE_M.inlet),
          repeatsForSize(inlet.l, TEXTURE_TILE_M.inlet),
        );
  return {
    face: new THREE.MeshStandardMaterial({
      name: 'InletFilterFace',
      map: maps?.map ?? null,
      roughnessMap: maps?.roughnessMap ?? null,
      color: maps === null ? 0x2a2d31 : 0xffffff,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide, // 방 안에서 올려다볼 때도, 밖에서 내려다볼 때도 보이게
    }),
    edge: new THREE.MeshStandardMaterial({
      name: 'InletFilterEdge',
      color: 0x3a3d42, // 판 테두리(필터 프레임)
      roughness: 0.8,
      metalness: 0,
    }),
  };
}

// geometry.room.inlets(세션 내 고정) 기준 1회만 만든다 — Detail3DView가 마운트될 때마다
// 텍스처를 새로 로드하지 않도록. detailRoomModel.ts의 preparedModelCache와 같은 이유다.
const panelCache = new WeakMap<object, THREE.Group>();

export function getOrBuildInletPanels(inlets: readonly RoomInlet[]): THREE.Group {
  const cached = panelCache.get(inlets);
  if (cached) return cached;
  const first = inlets[0];
  const materials = createInletMaterials(first ?? { x: 0, y: 0, z: 0, w: 0.32, l: 0.687 });
  const group = buildInletPanels(inlets, materials);
  panelCache.set(inlets, group);
  return group;
}
