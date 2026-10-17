// 상세보기 3D 자돈방 텍스처 — 바닥(플라스틱 슬랏) · 벽(패널) · 급기구(필터망).
// 원본은 docs/design/textures/, 서빙본은 public/assets/textures/ (2026-10-17 사용자 제공).
//
// 파일은 `<이름>_col.png`(색)과 `<이름>_data.png`(ORM 계열 패킹 맵) 쌍으로 온다.
// `_data`는 glTF ORM 관례대로 R=AO, G=거칠기, B=메탈릭으로 보고 쓰되 **거칠기(G)만** 연결한다 —
// 돈사 바닥 슬랏·벽 패널·필터망은 전부 비금속이라 B를 메탈릭으로 물리면 금속처럼 번들거린다.
// (B가 높이맵일 가능성도 있어 더더욱 연결하지 않는다.) AO는 uv2가 필요해 생략했다.
//
// 타일링은 "1 m당 몇 번 반복"으로 잡는다. 면 크기가 달라도 무늬 크기가 일정해야 하기 때문에
// 면마다 repeat을 치수에 비례해 계산한다(TEXTURE_SCALE_PER_M).
import * as THREE from 'three';

export const TEXTURE_BASE_URL = '/assets/textures';

export const DETAIL_TEXTURES = {
  floor: 'slat_green',
  wall: 'wall_panel',
  inlet: 'inlet_filter',
} as const;

/**
 * 무늬 1장이 덮는 실제 크기(m). 돈사 사진 기준 눈대중이라 바꾸기 쉽게 상수로 둔다.
 * - 바닥 슬랏: 1 m에 슬랏 묶음이 여러 개 보이도록 0.8 m
 * - 벽 패널: 세로 이음매 간격이 ~0.25 m라 가로 1 m에 네 장
 * - 급기구 필터: 급기구가 0.32 × 0.687 m라 한 장이면 눈이 너무 굵어 0.16 m로 잘게
 */
export const TEXTURE_TILE_M = {
  floor: 0.8,
  wall: 1.0,
  inlet: 0.16,
} as const;

/** 벽 패널은 위아래 색이 달라(위 밝은 회색 / 아래 어두운 회색) **세로로 반복하면 안 된다**. */
export const WALL_TEXTURE_REPEATS_VERTICALLY = false;

type TextureSet = { map: THREE.Texture; roughnessMap: THREE.Texture };

/**
 * `<name>_col` + `<name>_data`를 불러와 색/거칠기 맵으로 묶는다.
 * 같은 텍스처를 여러 면이 쓰므로 호출부에서 clone해 repeat만 따로 준다(아래 withRepeat).
 */
export function loadTextureSet(loader: THREE.TextureLoader, name: string): TextureSet {
  const map = loader.load(`${TEXTURE_BASE_URL}/${name}_col.png`);
  const roughnessMap = loader.load(`${TEXTURE_BASE_URL}/${name}_data.png`);

  // 색 맵만 sRGB. 데이터 맵(거칠기)은 선형으로 읽어야 값이 왜곡되지 않는다.
  map.colorSpace = THREE.SRGBColorSpace;
  roughnessMap.colorSpace = THREE.NoColorSpace;

  for (const tex of [map, roughnessMap]) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8; // 바닥을 비스듬히 볼 때 무늬가 뭉개지지 않게
  }
  return { map, roughnessMap };
}

/**
 * 면 크기(m)에 맞춰 repeat을 정한 **사본**을 만든다. 원본을 공유하면 한 면의 repeat이
 * 다른 면까지 바꿔 버린다.
 */
export function withRepeat(
  set: TextureSet,
  repeatU: number,
  repeatV: number,
): { map: THREE.Texture; roughnessMap: THREE.Texture } {
  const map = set.map.clone();
  const roughnessMap = set.roughnessMap.clone();
  for (const tex of [map, roughnessMap]) {
    tex.repeat.set(repeatU, repeatV);
    tex.needsUpdate = true;
  }
  return { map, roughnessMap };
}

/** 면 크기(m) → repeat 횟수. 최소 1회는 나오게 해서 무늬가 사라지지 않도록 한다. */
export function repeatsForSize(sizeM: number, tileM: number): number {
  if (!Number.isFinite(sizeM) || sizeM <= 0 || tileM <= 0) return 1;
  return Math.max(1, Math.round(sizeM / tileM));
}

/**
 * 브라우저에서만 텍스처 로더를 만든다. `THREE.TextureLoader`는 내부적으로 `document`로
 * 이미지를 만들기 때문에, node 환경(vitest)에서 부르면 "document is not defined"로 터진다.
 * 텍스처는 보기용이라 없어도 형상·치수 로직은 그대로 검증되므로 테스트에서는 건너뛴다.
 */
export function createTextureLoaderIfSupported(): THREE.TextureLoader | null {
  if (typeof document === 'undefined') return null;
  return new THREE.TextureLoader();
}
