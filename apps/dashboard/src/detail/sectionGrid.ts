// 2D 수평단면(13·19·26·33) — grid에서 SECTION_Z_M에 가장 가까운 z층(x·y 평면)을 꺼내
// 2배 쌍선형 보간한다(01-functional-spec.md 3장 "해상도와 표현"). 여기서 다루는 i·j는
// grid의 x·y 인덱스일 뿐 Three.js 좌표가 아니라 scene/coords.ts의 z-up→y-up 변환과는
// 무관하다(2D 캔버스 픽셀 좌표로만 쓰인다).
import type { GridDef } from '@ondo/shared';

/** SECTION_Z_M에 가장 가까운 grid z 인덱스(05-open-questions.md #16: SECTION_Z_M=0.5 → z=0.4층). */
export function nearestZIndex(grid: GridDef, sectionZ: number): number {
  const nz = grid.size[2];
  let bestK = 0;
  let bestDist = Infinity;
  for (let k = 0; k < nz; k++) {
    const z = grid.origin[2] + k * grid.spacing[2];
    const dist = Math.abs(z - sectionZ);
    if (dist < bestDist) {
      bestDist = dist;
      bestK = k;
    }
  }
  return bestK;
}

/**
 * 1차원 grid 값 배열(인덱스 공식 i + nx*(j + ny*k), docs/02-relay-api.md 5장)에서
 * z=k층의 x·y 평면을 2차원 배열로 꺼낸다. 결과는 layer[i][j].
 */
export function extractZLayer(values: readonly number[], grid: GridDef, k: number): number[][] {
  const [nx, ny] = grid.size;
  const layer: number[][] = [];
  for (let i = 0; i < nx; i++) {
    const row: number[] = [];
    for (let j = 0; j < ny; j++) {
      row.push(values[i + nx * (j + ny * k)] ?? 0);
    }
    layer.push(row);
  }
  return layer;
}

/**
 * 2배 쌍선형 보간 — 원본 샘플은 그대로 유지하고 그 사이 격자점에 보간값을 끼워 넣는다.
 * 입력 nx*ny → 출력 (2*nx-1)*(2*ny-1).
 */
export function bilinearUpsample2x(layer: readonly number[][]): number[][] {
  const nx = layer.length;
  const firstRow = layer[0];
  const ny = firstRow ? firstRow.length : 0;
  if (nx === 0 || ny === 0) return [];

  const outNx = nx * 2 - 1;
  const outNy = ny * 2 - 1;
  const out: number[][] = [];

  for (let oi = 0; oi < outNx; oi++) {
    const fi = oi / 2;
    const i0 = Math.floor(fi);
    const i1 = Math.min(i0 + 1, nx - 1);
    const tx = fi - i0;
    const row0 = layer[i0] ?? [];
    const row1 = layer[i1] ?? [];

    const outRow: number[] = [];
    for (let oj = 0; oj < outNy; oj++) {
      const fj = oj / 2;
      const j0 = Math.floor(fj);
      const j1 = Math.min(j0 + 1, ny - 1);
      const ty = fj - j0;

      const v00 = row0[j0] ?? 0;
      const v10 = row1[j0] ?? 0;
      const v01 = row0[j1] ?? 0;
      const v11 = row1[j1] ?? 0;
      const v0 = v00 + (v10 - v00) * tx;
      const v1 = v01 + (v11 - v01) * tx;
      outRow.push(v0 + (v1 - v0) * ty);
    }
    out.push(outRow);
  }
  return out;
}
