// flowGrid(9×8×4=288 노드 고정, docs/02-relay-api.md 5장) 노드 좌표 계산 — scene/
// FlowCylinders.tsx에서 분리한 순수 로직. 개수는 항상 GridDef.size에서 읽는다(하드코딩 금지,
// CLAUDE.md 규칙). 인덱스 공식은 grid와 같은 "i + nx*(j + ny*k)"를 쓴다(docs/02-relay-api.md
// 5장 — "격자 1차원 인덱스"는 grid·flowGrid 공통 GridDef 규칙).
import type { GridDef } from '@ondo/shared';

export function flowNodeCount(grid: GridDef): number {
  const [nx, ny, nz] = grid.size;
  return nx * ny * nz;
}

/** flat 인덱스 → (i,j,k) — i + nx*(j + ny*k) 공식의 역산. */
export function flowNodeIjk(grid: GridDef, index: number): [number, number, number] {
  const [nx, ny] = grid.size;
  const i = index % nx;
  const j = Math.floor(index / nx) % ny;
  const k = Math.floor(index / (nx * ny));
  return [i, j, k];
}

/** flowGrid 노드의 데이터 좌표(z-up, zUpToYUp 적용 전) — origin + spacing * (i,j,k). */
export function flowNodePosition(grid: GridDef, index: number): [number, number, number] {
  const [i, j, k] = flowNodeIjk(grid, index);
  return [
    grid.origin[0] + i * grid.spacing[0],
    grid.origin[1] + j * grid.spacing[1],
    grid.origin[2] + k * grid.spacing[2],
  ];
}
