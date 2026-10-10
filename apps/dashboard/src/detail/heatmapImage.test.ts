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

  it('픽셀 (i=0,j=0)은 layer[0][0] 값의 컬러맵 색상, alpha=255', () => {
    const layer = [
      [0, 10],
      [20, 30],
    ];
    const image = buildHeatmapImage(layer, 0, 30);
    const [r, g, b] = valueToRGB255(0, 0, 30);
    expect(image.data[0]).toBe(r);
    expect(image.data[1]).toBe(g);
    expect(image.data[2]).toBe(b);
    expect(image.data[3]).toBe(255);
  });

  it('픽셀 (i=1,j=1)은 layer[1][1] 값의 컬러맵 색상', () => {
    const layer = [
      [0, 10],
      [20, 30],
    ];
    const image = buildHeatmapImage(layer, 0, 30);
    const idx = (1 * image.width + 1) * 4;
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
    const [r, g, b] = valueToRGB255(0, 0, 30, 'flow');
    expect(image.data[0]).toBe(r);
    expect(image.data[1]).toBe(g);
    expect(image.data[2]).toBe(b);
  });
});
