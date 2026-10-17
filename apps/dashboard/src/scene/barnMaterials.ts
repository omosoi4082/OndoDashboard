// 메인 모델(weaner_barn.glb) 머티리얼 보정 — glb를 고치지 않고 로드 후 코드에서 손보는 것들.
// 모델이 계속 교체되므로(barnModel.ts 상단 주석), 노드 이름이 아니라 **머티리얼 이름**으로
// 찾고 못 찾으면 조용히 넘어간다.
import * as THREE from 'three';

/**
 * 벽 위 테두리(캡) 색 — 벽 패널의 **밝은 회색 띠** 평균값(`wall_panel_col.png` 상단 샘플 #bbbcbf).
 * 2026-10-17 사용자 요청: "벽 위 테두리 회색이였으면 좋겠는데 지금은 회색, 진회색 섞여있잖아".
 */
export const WALL_CAP_COLOR = 0xbbbcbf;

export const WALL_CAP_MATERIAL_NAME = 'GLTF_WallCap';

/**
 * 벽 캡이 회색·진회색으로 얼룩지는 것을 한 가지 회색으로 통일한다.
 *
 * 원인: `GLTF_WallCap`이 벽과 **같은 `wall_panel_basecolor` 텍스처**를 쓴다(glb 파싱 확인 —
 * texture[6]과 texture[4]가 같은 image[4]를 가리킨다). 그 텍스처는 위쪽이 밝은 회색,
 * 아래쪽이 진회색으로 갈려 있어서, 캡마다 UV가 어느 띠를 물었느냐에 따라 색이 달라졌다.
 * 캡은 얇은 테두리라 무늬가 필요 없으므로 맵을 떼고 단색으로 칠한다.
 *
 * 머티리얼은 캡 10장이 공유하므로 한 번만 손보면 된다. useGLTF 캐시를 공유하는 인스턴스라
 * 재마운트 때 또 불려도 괜찮도록 플래그로 멱등 처리한다.
 *
 * ★ **맵이 붙어 있을 때만 손본다.** 모델 쪽에서 캡을 단색으로 고쳐 내보내면(2026-10-17 사용자가
 * 그렇게 하겠다고 함) 이 보정은 할 일이 없어진다 — 그때도 무조건 색을 덮어쓰면 모델에서 고른
 * 회색을 코드가 조용히 밀어내서 "모델을 고쳤는데 왜 그 색이 아니냐"가 된다. 맵이 없으면
 * 이미 단색이라는 뜻이므로 그대로 둔다. 모델이 고쳐지면 이 함수 호출을 지워도 된다.
 */
export function normalizeWallCapMaterial(scene: THREE.Object3D, color: number = WALL_CAP_COLOR): number {
  let patched = 0;
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.material) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of materials) {
      if (mat.name !== WALL_CAP_MATERIAL_NAME) continue;
      if (mat.userData.ondoCapNormalized) continue;
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      if (mat.map === null) continue; // 모델이 이미 단색으로 준 경우 — 그 색을 존중한다
      mat.map = null; // 벽 패널 무늬(밝은 띠/진한 띠)를 떼어낸다
      mat.color.setHex(color);
      mat.userData.ondoCapNormalized = true;
      mat.needsUpdate = true;
      patched += 1;
    }
  });
  return patched;
}
