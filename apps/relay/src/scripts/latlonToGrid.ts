// npm run grid -- <lat> <lon>  →  기상청 LCC 격자(nx, ny) 출력. docs/04-tasks.md M1.
import { latLonToGrid } from '../transforms/latlonToGrid.js';

const [latArg, lonArg] = process.argv.slice(2);

if (!latArg || !lonArg) {
  console.error('사용법: npm run grid -- <lat> <lon>');
  process.exit(1);
}

const lat = Number(latArg);
const lon = Number(lonArg);

if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
  console.error(`[grid] 위경도 숫자를 해석할 수 없습니다: lat=${latArg} lon=${lonArg}`);
  process.exit(1);
}

const { nx, ny } = latLonToGrid(lat, lon);
console.log(`nx=${nx} ny=${ny}`);
