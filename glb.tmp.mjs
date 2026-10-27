import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const buf = readFileSync('apps/dashboard/public/assets/models/weaner_room_single.glb');
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
let off = 12, json = null;
while (off < buf.byteLength) {
  const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
  if (type === 0x4e4f534a) json = JSON.parse(buf.subarray(off + 8, off + 8 + len).toString('utf8'));
  off += 8 + len + ((4 - (len % 4)) % 4) * 0;
  if (json) break;
}
const nodes = json.nodes ?? [];
const meshes = json.meshes ?? [];
const accs = json.accessors ?? [];

const localMatrix = (n) => {
  const m = new THREE.Matrix4();
  if (n.matrix) return m.fromArray(n.matrix);
  const t = new THREE.Vector3(...(n.translation ?? [0, 0, 0]));
  const q = new THREE.Quaternion(...(n.rotation ?? [0, 0, 0, 1]));
  const s = new THREE.Vector3(...(n.scale ?? [1, 1, 1]));
  return m.compose(t, q, s);
};
const boxes = new Map();
const walk = (idx, parent) => {
  const n = nodes[idx];
  const world = parent.clone().multiply(localMatrix(n));
  if (n.mesh !== undefined) {
    const box = new THREE.Box3();
    for (const prim of meshes[n.mesh].primitives ?? []) {
      const a = accs[prim.attributes.POSITION];
      if (!a?.min) continue;
      const b = new THREE.Box3(new THREE.Vector3(...a.min), new THREE.Vector3(...a.max));
      b.applyMatrix4(world);
      box.union(b);
    }
    if (!box.isEmpty()) boxes.set(n.name ?? `mesh${idx}`, box);
  }
  for (const c of n.children ?? []) walk(c, world);
};
for (const s of json.scenes?.[json.scene ?? 0]?.nodes ?? []) walk(s, new THREE.Matrix4());

const fmt = (b) => {
  const s = new THREE.Vector3(); b.getSize(s);
  return `min(${b.min.x.toFixed(3)}, ${b.min.y.toFixed(3)}, ${b.min.z.toFixed(3)}) size(${s.x.toFixed(3)}, ${s.y.toFixed(3)}, ${s.z.toFixed(3)})`;
};
const shell = boxes.get('PigRoom_Walls_Flat');
console.log('shell(Walls_Flat)   ', fmt(shell));
const ss = new THREE.Vector3(); shell.getSize(ss);
const scaleY = 2.8 / ss.y, scaleX = 4.5 / ss.x, scaleZ = 4.0 / ss.z;
console.log('scale -> x', scaleX.toFixed(4), 'y', scaleY.toFixed(4), 'z', scaleZ.toFixed(4));
for (const [name, b] of boxes) {
  if (!/^PigRoom_W|Inlet/.test(name)) continue;
  const s = new THREE.Vector3(); b.getSize(s);
  const yTop = (b.max.y - shell.min.y) * scaleY;
  const yBot = (b.min.y - shell.min.y) * scaleY;
  console.log(
    name.padEnd(22),
    'bottom', yBot.toFixed(3), 'm  top', yTop.toFixed(3), 'm',
    ' x', ((b.min.x - shell.min.x) * scaleX).toFixed(2), '~', ((b.max.x - shell.min.x) * scaleX).toFixed(2),
    ' z', ((b.min.z - shell.min.z) * scaleZ).toFixed(2), '~', ((b.max.z - shell.min.z) * scaleZ).toFixed(2),
  );
}
