// 축척(스케일 바, 01-functional-spec.md 2장 #8) — 막대형, 1 unit = 1 m. 메인 3D 왼쪽 아래에
// "라벨 + 양끝이 올라간 가는 선"으로 표시(docs/06-design-guide.md). 값 자체는
// scene/CameraRig.tsx가 OrbitControls 변화에 맞춰 store에 써준다.
import type { ReactElement } from 'react';
import { useMainStore } from '../store/mainStore.js';

export function ScaleBar(): ReactElement {
  const scaleBar = useMainStore((s) => s.scaleBar);

  return (
    <div className="flex items-end gap-2 text-[11px] text-white/80">
      <span className="leading-none">{scaleBar ? `${scaleBar.meters}m` : '-'}</span>
      <div
        className="h-1.5 border-x border-b border-white/80"
        style={{ width: scaleBar ? `${scaleBar.px}px` : '0px' }}
      />
    </div>
  );
}
