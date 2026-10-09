// 축척(스케일 바, 01-functional-spec.md 2장 #8) — 막대형, 1 unit = 1 m.
// 값 자체는 scene/CameraRig.tsx가 OrbitControls 변화에 맞춰 store에 써준다.
import type { ReactElement } from 'react';
import { useMainStore } from '../store/mainStore.js';

export function ScaleBar(): ReactElement {
  const scaleBar = useMainStore((s) => s.scaleBar);

  return (
    <div className="flex items-center gap-2 text-xs text-white/80">
      <div className="h-1.5 bg-cyan-300" style={{ width: scaleBar ? `${scaleBar.px}px` : '0px' }} />
      <span>{scaleBar ? `${scaleBar.meters} m` : '-'}</span>
    </div>
  );
}
