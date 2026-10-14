// 육성·비육방 돼지 — 자돈방 돼지(glb의 'Pigs' 그룹, Pig_01~19)를 복제해 각 방에 19두씩
// 놓는다(온도 측 2026-10-14 회신).
//
// 회신 내용: "돼지 수는 세 방 모두 자돈방과 같게 해 주세요(19두). ... 전체 크기는 자돈 1 :
// 육성돈 1.4 : 비육돈 1.8 정도를 기준으로 하되, 모습이 어색하면 보기 좋게 조정하셔도 됩니다."
// 체형은 "성돈 체형(몸통을 더 두껍게)"을 요청받았지만 **성돈 모델이 없다** — glb에는 자돈
// 모델 하나뿐이라, docs/01-functional-spec.md 2장의 기존 규칙("자돈 < 육성 < 비육 순으로
// 키운다")대로 **같은 모델을 비율만 키워** 쓴다. 성돈 모델을 받으면 PIG_SOURCE_GROUP만
// 바꿔 끼우면 된다(05-open-questions.md #48).
//
// 원본 무리 배치를 통째로 확대하지 않는 이유는 pigLayout.ts 머리말 참고(방 폭을 넘는다).
import * as THREE from 'three';
import type { RoomId } from '@ondo/shared';
import { findSection, type BarnSection } from './barnModel.js';
import { pigAreaFromBox, planPigSlots } from './pigLayout.js';

/** 자돈(NH) 대비 크기 비율 — 온도 측 2026-10-14 회신값. */
export const ROOM_PIG_SCALE: Record<RoomId, number> = { NH: 1, GH: 1.4, FH: 1.8 };

/** 돼지를 벽에 붙이지 않는 여유(m) — 1.8배 비육돈 몸길이(약 1.06 m)의 1/3 수준. */
export const PIG_WALL_MARGIN_M = 0.35;

/** glb에서 자돈방 돼지 19두가 묶여 있는 그룹 이름. */
export const PIG_SOURCE_GROUP = 'Pigs';

/** 복제한 돼지를 담는 그룹 이름 — 같은 모델에 두 번 호출돼도 이 그룹을 갈아끼워 멱등하게 둔다. */
const CLONE_GROUP_NAME = 'OndoRoomPigs';

/** 육성·비육방은 회색이다(01-functional-spec.md 2장) — glb에 들어 있는 회색 머티리얼을 그대로 쓴다. */
const GRAY_MATERIAL_NAME = 'PigRoom_Gray';

function findGrayMaterial(modelRoot: THREE.Object3D): THREE.Material | null {
  let found: THREE.Material | null = null;
  modelRoot.traverse((obj) => {
    if (found || !(obj instanceof THREE.Mesh)) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (material.name === GRAY_MATERIAL_NAME) {
        found = material;
        return;
      }
    }
  });
  return found;
}

/**
 * 자돈방 돼지를 복제해 지정한 방들에 배치한 그룹을 modelRoot에 붙이고 돌려준다.
 * 자돈방(NH)은 원본이 이미 있으므로 대상에서 뺀다. 원본 그룹이 없으면 null.
 */
export function buildRoomPigs(
  modelRoot: THREE.Object3D,
  sections: readonly BarnSection[],
  targetRoomIds: readonly RoomId[] = ['GH', 'FH'],
): THREE.Group | null {
  const source = modelRoot.getObjectByName(PIG_SOURCE_GROUP);
  if (!source || source.children.length === 0) return null;

  // 같은 glb 인스턴스가 캐시로 재사용되므로(useGLTF) 이전 결과가 있으면 지우고 다시 만든다.
  const previous = modelRoot.getObjectByName(CLONE_GROUP_NAME);
  if (previous) previous.removeFromParent();

  modelRoot.updateMatrixWorld(true);
  const toModelSpace = modelRoot.matrixWorld.clone().invert();
  const gray = findGrayMaterial(modelRoot);

  // 원본 돼지가 서 있는 바닥 높이 — 세 방 모두 바닥 높이가 같아서 그대로 쓸 수 있다
  // (자돈방 돼지 최저점 0.15 m, 육성·비육방 바닥 슬래브 윗면 0.155 m).
  const floorY = new THREE.Box3().setFromObject(source).min.y;

  const group = new THREE.Group();
  group.name = CLONE_GROUP_NAME;
  modelRoot.add(group);

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  for (const roomId of targetRoomIds) {
    const section = findSection(sections, roomId);
    if (!section) continue;
    const slots = planPigSlots(source.children.length, pigAreaFromBox(section.center, section.size, PIG_WALL_MARGIN_M));
    const factor = ROOM_PIG_SCALE[roomId];

    source.children.forEach((pig, index) => {
      const slot = slots[index];
      if (!slot) return;

      const clone = pig.clone(true);
      // 원본은 'Pigs' > 'P1' 아래에 있어 좌표가 그 그룹 기준이다 — modelRoot 기준으로 바꿔
      // 담아야 방을 옮겨 놓을 수 있다(원본의 회전은 제각각이라 그대로 살린다).
      pig.updateMatrixWorld(true);
      toModelSpace.clone().multiply(pig.matrixWorld).decompose(position, quaternion, scale);
      clone.position.copy(position);
      clone.quaternion.copy(quaternion);
      clone.scale.copy(scale).multiplyScalar(factor);
      clone.position.x = slot.x;
      clone.position.z = slot.z;

      clone.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        if (gray) obj.material = gray;
        obj.castShadow = true;
        obj.receiveShadow = true;
      });
      clone.userData.roomId = roomId;

      group.add(clone);
      // 키운 만큼 발이 바닥에서 뜨거나 묻히므로, 붙인 뒤 실제 높이를 재서 바닥에 맞춘다.
      clone.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(clone);
      clone.position.y += floorY - box.min.y;
    });
  }

  group.updateMatrixWorld(true);
  return group;
}
