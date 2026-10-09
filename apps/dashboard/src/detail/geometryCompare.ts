// geometryId 비교 — docs/02-relay-api.md 5장 "DetailBase.geometryId: 보관한 Geometry와
// 다르면 geometry 재요청". 순수 비교 로직만 미리 준비해 둔다. 실제 트리거(Current 등
// 상세 응답을 받았을 때 호출)는 M4부터 연결한다(지금은 GET /api/detail/current가 없다).
import type { Geometry } from '@ondo/shared';

export function shouldRefetchGeometry(current: Geometry | null, incomingGeometryId: string): boolean {
  return current === null || current.geometryId !== incomingGeometryId;
}
