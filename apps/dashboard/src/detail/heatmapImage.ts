// 2D 히트맵 캔버스 픽셀 버퍼 — 컬러맵 적용은 detail/colormap.ts를 재사용하고, canvas API
// 자체(putImageData 등)는 컴포넌트(Detail2DSection)에서 호출한다. 순수 함수로 분리해
// 테스트 가능하게 한다(CLAUDE.md 코드 규칙).
import { valueToRGB255 } from './colormap.js';
import type { ValueField } from '../store/detailStore.js';

export interface HeatmapImage {
  width: number;
  height: number;
  // ImageData 생성자가 요구하는 타입(ArrayBuffer 고정, ArrayBufferLike 불가)에 맞춰
  // 제네릭을 명시한다 — `new Uint8ClampedArray(n)`은 항상 ArrayBuffer로 뒷받침된다.
  data: Uint8ClampedArray<ArrayBuffer>; // RGBA, width*height*4
}

/** layer[i][j](i=x, j=y) → RGBA 픽셀 버퍼. 이미지 row=j, col=i로 둔다. */
export function buildHeatmapImage(
  layer: readonly (readonly number[])[],
  min: number,
  max: number,
  field: ValueField = 'temp',
): HeatmapImage {
  const width = layer.length;
  const firstRow = layer[0];
  const height = firstRow ? firstRow.length : 0;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const row = layer[i];
      const value = row ? row[j] ?? 0 : 0;
      const [r, g, b] = valueToRGB255(value, min, max, field);
      const pixelIndex = (j * width + i) * 4;
      data[pixelIndex] = r;
      data[pixelIndex + 1] = g;
      data[pixelIndex + 2] = b;
      data[pixelIndex + 3] = 255;
    }
  }
  return { width, height, data };
}
