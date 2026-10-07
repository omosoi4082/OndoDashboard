import { describe, expect, it } from 'vitest';
import { latLonToGrid } from './latlonToGrid.js';

describe('latLonToGrid', () => {
  it('서울시청(37.5665, 126.9780) → (60, 127)', () => {
    expect(latLonToGrid(37.5665, 126.978)).toEqual({ nx: 60, ny: 127 });
  });
});
