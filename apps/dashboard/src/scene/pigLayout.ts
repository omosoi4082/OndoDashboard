// 육성·비육방 돼지 배치 좌표 계산(순수 함수) — scene/roomPigs.ts가 three.js 객체를 만들 때
// 쓴다. 온도 측 2026-10-14 회신: "돼지 수는 세 방 모두 자돈방과 같게(19두)".
//
// 자돈방 원본 배치를 그대로 복사해 키우는 방법은 못 쓴다 — 원본 무리는 3.71×4.19 m인데
// 1.4배면 5.19 m라 방 폭(4.2 m)을 넘는다. 그래서 각 돼지는 요청한 비율로 키우고, 자리만
// 방 크기에 맞춰 다시 잡는다(겹침 없이 방 안에 고르게 퍼진다).
export interface PigArea {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface PigSlot {
  x: number;
  z: number;
}

/**
 * count개를 area 안에 격자로 고르게 배치한다. 열 수는 방의 가로:세로 비율을 따라 정해
 * 칸이 최대한 정사각형에 가깝게 되도록 한다(한 줄로 늘어서거나 벽에 몰리지 않게).
 * 마지막 줄이 덜 차면 그 줄만 가운데로 모은다.
 */
export function planPigSlots(count: number, area: PigArea): PigSlot[] {
  if (count <= 0) return [];
  const width = area.maxX - area.minX;
  const depth = area.maxZ - area.minZ;
  if (width <= 0 || depth <= 0) return [];

  // 올림(ceil)으로 열을 한 칸 더 잡는다 — 반올림하면 12 m짜리 비육방이 2열 10줄로 나와
  // 돼지가 한 줄로 늘어선 것처럼 보인다. 올림이면 3열 7줄로 방 폭을 고르게 채운다.
  const cols = Math.min(Math.max(Math.ceil(Math.sqrt((count * width) / depth)), 1), count);
  const rows = Math.ceil(count / cols);
  const cellW = width / cols;
  const cellD = depth / rows;

  const slots: PigSlot[] = [];
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    // 마지막 줄에 남은 개수가 cols보다 적으면 그 줄만 가운데 정렬한다.
    const inRow = Math.min(cols, count - row * cols);
    const centerOffset = (cols - inRow) / 2;
    slots.push({
      x: area.minX + (col + centerOffset + 0.5) * cellW,
      z: area.minZ + (row + 0.5) * cellD,
    });
  }
  return slots;
}

/** 방 바운딩박스를 벽에서 margin만큼 안쪽으로 좁힌 배치 영역. 너무 좁으면 중앙 한 점으로 수렴한다. */
export function pigAreaFromBox(
  center: { x: number; z: number },
  size: { x: number; z: number },
  margin: number,
): PigArea {
  const halfX = Math.max(size.x / 2 - margin, 0);
  const halfZ = Math.max(size.z / 2 - margin, 0);
  return {
    minX: center.x - halfX,
    maxX: center.x + halfX,
    minZ: center.z - halfZ,
    maxZ: center.z + halfZ,
  };
}
