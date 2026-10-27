import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const SC = 'C:/Users/User/AppData/Local/Temp/claude/E--ondo-dashboard-starter-kit-ondo-dashboard-starter-kit/682bce4d-f1de-448f-a027-42d6023f3a25/scratchpad';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto('file:///' + SC + '/v.html');
const meta = await p.evaluate(() => new Promise((res, rej) => {
  const v = document.getElementById('v');
  if (v.readyState >= 1) return res({ d: v.duration, w: v.videoWidth, h: v.videoHeight });
  v.addEventListener('loadedmetadata', () => res({ d: v.duration, w: v.videoWidth, h: v.videoHeight }));
  v.addEventListener('error', () => rej(new Error('video error ' + (v.error && v.error.code))));
  setTimeout(() => rej(new Error('timeout')), 15000);
}));
console.log('길이', meta.d.toFixed(1), '초', meta.w + 'x' + meta.h);
const times = [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => Math.min(meta.d - 0.05, meta.d * f));
let i = 0;
for (const t of times) {
  const data = await p.evaluate((t) => new Promise((res) => {
    const v = document.getElementById('v');
    v.currentTime = t;
    v.addEventListener('seeked', () => {
      const c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      res(c.toDataURL('image/png'));
    }, { once: true });
  }), t);
  const buf = Buffer.from(data.split(',')[1], 'base64');
  writeFileSync(`${SC}/vid-${i}.png`, buf);
  console.log(`${t.toFixed(1)}초 → vid-${i}.png (${(buf.length / 1024).toFixed(0)}KB)`);
  i++;
}
await b.close();
