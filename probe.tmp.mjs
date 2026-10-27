import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('http://localhost:8080');
await p.getByRole('button', { name: '예측 모드', exact: true }).click();
await p.waitForTimeout(9000);
const out = await p.evaluate(() => {
  const canvases = [...document.querySelectorAll('canvas')];
  const res = [];
  for (const c of canvases) {
    const r3f = c.__r3f ?? c.parentElement?.__r3f;
    const state = r3f?.root?.getState?.();
    if (!state) { res.push({ no: true }); continue; }
    const scene = state.scene;
    const items = [];
    scene.traverse((o) => {
      if (!o.name) return;
      if (/^PigRoom_W|Inlet|Walls_Flat|FloorSlab/.test(o.name)) {
        const box = new (window.THREE?.Box3 ?? Object)();
        items.push({ name: o.name, type: o.type });
      }
    });
    res.push({ count: items.length, names: items.map((i) => i.name).slice(0, 20) });
  }
  return res;
});
console.log(JSON.stringify(out));
await b.close();
