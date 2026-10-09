import { describe, expect, it } from 'vitest';
import { flowNodeCount, flowNodeIjk, flowNodePosition } from './flowNodes.js';
import type { GridDef } from '@ondo/shared';

const flowGrid: GridDef = { origin: [0.25, 0.25, 0.35], spacing: [0.5, 0.5, 0.7], size: [9, 8, 4] };

describe('flowNodeCount', () => {
  it('size에서 9*8*4=288을 읽는다', () => {
    expect(flowNodeCount(flowGrid)).toBe(288);
  });
});

describe('flowNodeIjk', () => {
  it('인덱스 0은 (0,0,0)', () => {
    expect(flowNodeIjk(flowGrid, 0)).toEqual([0, 0, 0]);
  });

  it('i가 가장 안쪽 루프 — 인덱스 1은 (1,0,0)', () => {
    expect(flowNodeIjk(flowGrid, 1)).toEqual([1, 0, 0]);
  });

  it('인덱스 9는 (0,1,0)(i가 nx=9를 한 바퀴 돌면 j가 증가)', () => {
    expect(flowNodeIjk(flowGrid, 9)).toEqual([0, 1, 0]);
  });

  it('인덱스 72(=9*8)는 (0,0,1)(j까지 한 바퀴 돌면 k가 증가)', () => {
    expect(flowNodeIjk(flowGrid, 72)).toEqual([0, 0, 1]);
  });

  it('마지막 인덱스 287은 (8,7,3)', () => {
    expect(flowNodeIjk(flowGrid, 287)).toEqual([8, 7, 3]);
  });
});

describe('flowNodePosition', () => {
  it('origin + spacing*(i,j,k)', () => {
    expect(flowNodePosition(flowGrid, 0)).toEqual([0.25, 0.25, 0.35]);
    expect(flowNodePosition(flowGrid, 1)).toEqual([0.75, 0.25, 0.35]);
    expect(flowNodePosition(flowGrid, 9)).toEqual([0.25, 0.75, 0.35]);
  });
});
