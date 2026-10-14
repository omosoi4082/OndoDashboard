import { describe, expect, it } from 'vitest';
import { buildHeatmapImage } from './heatmapImage.js';
import { valueToRGB255 } from './colormap.js';

describe('buildHeatmapImage', () => {
  it('width*height*4 길이의 RGBA 버퍼를 만든다', () => {
    const layer = [
      [0, 10],
      [20, 30],
    ];
    const image = buildHeatmapImage(layer, 0, 30);
    expect(image.width).toBe(2);
    expect(image.height).toBe(2);
    expect(image.data).toHaveLength(2 * 2 * 4);
  });

  it('y = 0(j=0)은 맨 아래 줄: 왼쪽 아래 픽셀이 layer[0][0], alpha=255', () => {
    const layer = [
      [0, 10],
      [20, 30],
    ];
    const image = buildHeatmapImage(layer, 0, 30);
    const idx = ((image.height - 1) * image.width + 0) * 4;
    const [r, g, b] = valueToRGB255(0, 0, 30);
    expect(image.data[idx]).toBe(r);
    expect(image.data[idx + 1]).toBe(g);
    expect(image.data[idx + 2]).toBe(b);
    expect(image.data[idx + 3]).toBe(255);
  });

  it('맨 위 줄 오른쪽 픽셀은 layer[1][1](y가 가장 큰 값)', () => {
    const layer = [
      [0, 10],
      [20, 30],
    ];
    const image = buildHeatmapImage(layer, 0, 30);
    const idx = (0 * image.width + 1) * 4;
    const [r, g, b] = valueToRGB255(30, 0, 30);
    expect(image.data[idx]).toBe(r);
    expect(image.data[idx + 1]).toBe(g);
    expect(image.data[idx + 2]).toBe(b);
  });

  it('빈 layer는 0 크기', () => {
    const image = buildHeatmapImage([], 0, 1);
    expect(image.width).toBe(0);
    expect(image.height).toBe(0);
    expect(image.data).toHaveLength(0);
  });

  it('field를 지정하면 그 필드의 색 범위(FIELD_COLOR_RANGES)로 칠한다', () => {
    const layer = [[0, 30]];
    const image = buildHeatmapImage(layer, 0, 30, 'flow');
    const idx = (image.height - 1) * image.width * 4; // j=0(값 0)은 맨 아래 줄
    const [r, g, b] = valueToRGB255(0, 0, 30, 'flow');
    expect(image.data[idx]).toBe(r);
    expect(image.data[idx + 1]).toBe(g);
    expect(image.data[idx + 2]).toBe(b);
  });
});
