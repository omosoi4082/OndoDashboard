// docs/02-relay-api.md 기준 API 계약 타입. 양쪽(apps/dashboard, apps/relay)에서 이 파일만 import한다.
// 타입을 앱 안에 복제하지 않는다 — 계약이 바뀌면 이 파일과 docs/02-relay-api.md를 같이 갱신한다.

export type Iso8601 = string;
export type SourceStatus = 'ok' | 'disconnected';
export type UpstreamSource = 'sensor' | 'kma' | 'compute' | 'relay';

export interface ApiOk<T> {
  status: 'ok' | 'partial'; // partial: 응답 안 일부 항목만 실패
  requestedAt: Iso8601;
  data: T;
}

export type ApiErrorCode =
  | 'BAD_REQUEST' // 400
  | 'UPSTREAM_TIMEOUT' // 504
  | 'UPSTREAM_ERROR' // 502 오류 응답 또는 데이터 부족(이력 결측 등)
  | 'UPSTREAM_UNREACHABLE' // 502
  | 'INTERNAL_ERROR'; // 500

export interface ApiError {
  status: 'error';
  requestedAt: Iso8601;
  error: { code: ApiErrorCode; source: UpstreamSource; message: string };
}

export type ApiResponse<T> = ApiOk<T> | ApiError;

// 3. 날씨 코드 (아이콘)
export type WeatherCode =
  | 'CLEAR'
  | 'PARTLY_CLOUDY'
  | 'MOSTLY_CLOUDY'
  | 'OVERCAST'
  | 'RAIN'
  | 'RAIN_SNOW'
  | 'SNOW';

// 4.1 GET /api/main/rooms
export type RoomId = 'NH' | 'GH' | 'FH';

export interface RoomSummary {
  name: '자돈방' | '육성돈방' | '비육돈방';
  sourceStatus: SourceStatus;
  measuredAt: Iso8601 | null;
  temp: number | null;
  rh: number | null;
  nh3: number | null;
  co2: number | null;
  fanRate: number | null; // 환기량 = FN1 FAN1 가동률(%) 확정
}

export type RoomsResponse = Record<RoomId, RoomSummary>;

// 4.2 GET /api/main/weather/kma
export interface KmaWeather {
  label: '기상청 실황';
  sourceStatus: SourceStatus;
  baseAt: Iso8601 | null;
  weatherCode: WeatherCode | null;
  isNight: boolean;
  windDir: string | null;
  windDeg: number | null;
  temp: number | null;
  rh: number | null;
}

// 4.3 GET /api/main/weather/station
export interface StationWeather {
  label: '미세기후';
  sourceStatus: SourceStatus;
  measuredAt: Iso8601 | null;
  weatherCode: WeatherCode | null;
  isNight: boolean;
  windDir: string | null;
  windDeg: number | null;
  temp: number | null;
  rh: number | null;
  rain: number | null;
  solar: number | null;
}

// 5. 상세 데이터 구조 (current / forecast / expert / control 공통)
export interface GridDef {
  origin: [number, number, number];
  spacing: [number, number, number];
  size: [number, number, number];
}

export type FlowVec = [number, number, number, number]; // vx, vy, vz, value

// 05-open-questions.md #2 (2026-10-07 확정): 연산 서버 응답에 top-level model_version,
// 프레임별 outdoor·summary·quality 4개 필드 추가.
export interface DetailFrameOutdoor {
  T_out: number | null;
  RH_out: number | null;
  fan_pct: number | null;
}

export interface DetailFrameSummary {
  T_mean: number;
  T_min: number;
  T_max: number;
  T_west: number;
  T_east: number;
  RH_mean: number;
  V_mean: number;
  V_max: number;
}

export interface DetailFrameQuality {
  in_range: boolean;
  warnings: string[];
}

export interface DetailFrame {
  offsetMin: number;
  time: Iso8601;
  points: { temp: number[]; rh: number[]; flow: FlowVec[] }; // 125
  grid: { temp: number[]; rh: number[] }; // nx*ny*nz
  flow: FlowVec[]; // flowGrid 노드 수
  outdoor: DetailFrameOutdoor;
  summary: DetailFrameSummary;
  quality: DetailFrameQuality;
}

export interface MinMax {
  min: number;
  max: number;
}

// GET /api/detail/geometry, 상세 진입 시 1회
export interface Geometry {
  geometryId: string; // 예: 'pig-nh-v1'
  room: { size: [number, number, number] }; // [4.5, 4.0, 2.8]
  points: { id: number; x: number; y: number; z: number }[]; // 125
  grid: GridDef; // spacing [0.25,0.25,0.4], size [19,17,8]
  flowGrid: GridDef; // origin [0.25,0.25,0.35], spacing [0.5,0.5,0.7], size [9,8,4]
}

export interface DetailBase {
  baseAt: Iso8601;
  intervalMin: 10;
  geometryId: string; // 보관한 Geometry와 다르면 geometry 재요청
  model_version: string; // 연산 서버 원응답 필드명 그대로(05-open-questions.md #2)
  range: { temp: MinMax; rh: MinMax; flow: MinMax }; // 전체 프레임 기준
  frames: DetailFrame[];
}

export interface CurrentDetail extends DetailBase {
  mode: 'current';
}

export interface ForecastDetail extends DetailBase {
  mode: 'forecast';
}

export interface ExpertDetail extends DetailBase {
  mode: 'expert';
  input: { temp: number; rh: number; vent: number };
}

export interface ControlBlock {
  baselineFanPct: number[]; // 145, frames와 같은 순서
  optimizedFanPct: number[]; // 145
  baselineTMean: number[]; // 145
  optimizedTMean: number[]; // 145
  energyKwh: { baseline: number; optimized: number };
  savingPct: number;
  tMax: { baseline: number; optimized: number };
  constraint: { tMeanMax: number };
}

export interface ControlDetail extends DetailBase {
  mode: 'control';
  target: 'energy' | 'environment';
  control: ControlBlock;
}

// 7. GET /api/health
export interface Health {
  relay: SourceStatus;
  sensor: SourceStatus;
  kma: SourceStatus;
  compute: SourceStatus;
}
