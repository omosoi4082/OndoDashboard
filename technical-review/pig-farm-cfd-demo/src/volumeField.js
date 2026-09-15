import { ROOM } from "./config.js";
import { colormap } from "./colormap.js";

export const MC_RESOLUTION = 28;

// 합성(예시) CFD 데이터 함수 — barn.seed / barn.ach로 축사별 차이를 줌.
// 실제 연동 시: 여기를 barnId + tMin 기준으로 서버에서 받아온 실제 프레임 값으로 교체하면 됩니다.
function sampleTemperatureAt(x, y, z, tMin, barn) {
  const effMin = tMin * (barn.ach / 20); // ACH가 높을수록 더 빨리 섞임
  const mix = Math.min(effMin / 60, 1);
  const inletX = 0.8 + barn.seed * 0.4, inletZ = 0.8 + barn.seed * 0.3;
  const distToInlet = Math.hypot(x - inletX, y - 2.6, z - inletZ);
  const spreadRadius = 1.2 + mix * 3.5;
  const jet = Math.exp(-(distToInlet / spreadRadius) * 2.2);
  const swirl = 0.06 * Math.sin(x * 1.3 + effMin * 0.05 + barn.seed) * Math.cos(z * 1.1 - effMin * 0.04);
  const base = 0.15 + 0.35 * mix;
  return Math.min(Math.max(base + jet * 0.85 + swirl, 0), 1);
}

/* field 인덱스 공식은 three.js MarchingCubes 내부 규약과 동일해야 합니다:
   idx = i + j*size + k*size*size  (i=x격자, j=y격자, k=z격자, 0~size-1)
   world 좌표는 i/(size-1) 비율로 0~ROOM 치수에 선형 매핑됩니다. */

// 실제 연동 시: 이 함수 내부를 "서버에서 받아온 frameIndex번째 CFD 프레임 배열"로
// 교체하면 됩니다. 지금은 임의 좌표에 sampleTemperatureAt()으로 테스트 값을 채웁니다.
export function bakeFrames(barn) {
  if (barn._frames) return barn._frames;
  const size = MC_RESOLUTION;
  const frames = [];
  for (let f = 0; f <= 30; f++) {
    const tMin = f * 2;
    const arr = new Float32Array(size * size * size);
    for (let k = 0; k < size; k++) {
      const z = ROOM.d * (k / (size - 1));
      for (let j = 0; j < size; j++) {
        const y = ROOM.h * (j / (size - 1));
        for (let i = 0; i < size; i++) {
          const x = ROOM.w * (i / (size - 1));
          const v = sampleTemperatureAt(x, y, z, tMin, barn); // 0~1 정규화 값
          arr[i + j * size + k * size * size] = v * 200; // isolation(60)과 비교 가능한 스케일로 변환
        }
      }
    }
    frames.push(arr);
  }
  barn._frames = frames;
  return frames;
}

export function updateVolume(mcEffect, mcMaterial, tMin, barn, spreadIntensity) {
  const frames = bakeFrames(barn);
  const frameIndex = Math.round(tMin / 2); // 0~30, 슬라이더 프레임과 그대로 대응
  const currentFrameArray = frames[frameIndex];
  mcEffect.field.set(currentFrameArray); // ← 공식/애니메이션 없이, 그 프레임 값을 통째로 주입
  mcEffect.isolation = 60 / spreadIntensity; // 강도를 올리면 임계값이 낮아져 표면이 더 넓게 잡힘
  mcEffect.update();

  const mix = Math.min((tMin * (barn.ach / 20)) / 60, 1);
  const [r, g, b] = colormap(0.3 + mix * 0.5);
  mcMaterial.color.setRGB(r, g, b);

  return currentFrameArray;
}
