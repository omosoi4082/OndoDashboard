# 02. 중계 서버 API (대시보드 ↔ 중계 서버)

원본: Google Docs "중계 서버 API 명세서" 탭(기능 명세서 v-006 기준). 온도 대시보드 연동명세서 v1.0은 회의 이전 참고 자료이며, 다르면 회의 결정을 따른다. 아래 타입을 `packages/shared/src/api.ts`에 그대로 옮겨 양쪽에서 사용한다.

## 1. 공통

- Base URL `http://localhost:8080`(`PORT`). 개발 중에는 Vite가 `/api`를 relay로 프록시한다.
- 대시보드 ↔ 중계 서버는 GET, JSON(UTF-8). 큰 응답(상세 API)은 gzip 압축(`@fastify/compress`).
- 시간: 대시보드 응답은 ISO 8601 + `+09:00`.
- 단위: 온도 ℃, 습도 %, NH3·CO2 ppm, 팬 가동률 %, 유속 m/s, 좌표 m, 풍향은 16방위 문자열 + 각도(°).
- 메인 화면 API는 화면 영역별로 분리한다. 한 상위 서버가 실패해도 다른 영역은 표시된다.
- 상세 API는 실험군(EX) 자돈방 데이터만 다룬다.

| 경로 | 화면(설계 번호) | 호출 시점 |
|---|---|---|
| `GET /api/main/rooms` | 메인 호버 정보(5-1~5-3) | 접속 시 1회, 이후 10분마다 |
| `GET /api/main/weather/kma` | 외부환경 3-1 기상청 실황 | 접속 시 1회, 이후 10분마다 |
| `GET /api/main/weather/station` | 외부환경 3-2 미세기후 | 접속 시 1회, 이후 10분마다 |
| `GET /api/detail/current` | 현재 모드(9~13) | 상세 진입 시, 현재 모드 유지 중 10분마다 |
| `GET /api/detail/forecast` | 예측 모드(14~19) | 예측 탭 선택 시 1회 |
| `GET /api/detail/expert` | 전문가 모드(20~26) | 입력 후 확인 클릭 시 |
| `GET /api/detail/control` | 제어 모드(27~33) | 탭 선택 시, 최적화 버튼 전환 시 |
| `GET /api/health` | 진단용, 화면 표시 없음 | 설치·이관 시 브라우저로 직접 확인 |

## 2. 공통 타입

```ts
export type Iso8601 = string;
export type SourceStatus = 'ok' | 'disconnected';
export type UpstreamSource = 'sensor' | 'kma' | 'compute' | 'relay';

export interface ApiOk<T> {
  status: 'ok' | 'partial';   // partial: 응답 안 일부 항목만 실패
  requestedAt: Iso8601;
  data: T;
}
export type ApiErrorCode =
  | 'BAD_REQUEST'            // 400
  | 'UPSTREAM_TIMEOUT'       // 504
  | 'UPSTREAM_ERROR'         // 502 오류 응답 또는 데이터 부족(이력 결측 등)
  | 'UPSTREAM_UNREACHABLE'   // 502
  | 'INTERNAL_ERROR';        // 500
export interface ApiError {
  status: 'error';
  requestedAt: Iso8601;
  error: { code: ApiErrorCode; source: UpstreamSource; message: string };
}
export type ApiResponse<T> = ApiOk<T> | ApiError;
```

- partial: 받은 값만 채우고, 실패 항목은 값 `null` + `sourceStatus: 'disconnected'`. 대시보드는 그 항목만 끊김 표시.
- 상세 API처럼 한 상위 서버(연산 서버)에 결과 전체가 달린 경우 실패하면 `ApiError`.
- 중계 서버 자체에 접속 실패(네트워크 오류)면 모든 영역 끊김 표시.

## 3. 날씨 코드 (아이콘)

```ts
export type WeatherCode =
  | 'CLEAR' | 'PARTLY_CLOUDY' | 'MOSTLY_CLOUDY' | 'OVERCAST'
  | 'RAIN' | 'RAIN_SNOW' | 'SNOW';
```

필수 아이콘 7종 + 선택 2종(CLEAR·MOSTLY_CLOUDY 밤 버전, `isNight: true`일 때). `weatherCode: null`이면 아이콘 대신 '-'. 매핑 규칙은 `03-upstream-apis.md` 3장.

## 4. 메인 화면 API

### 4.1 `GET /api/main/rooms`

센서 서버 6개 경로(NH·GH·FH × EN1·FN1) 병렬 호출. 방 단위 partial.

```ts
export type RoomId = 'NH' | 'GH' | 'FH';
export interface RoomSummary {
  name: '자돈방' | '육성돈방' | '비육돈방';
  sourceStatus: SourceStatus;
  measuredAt: Iso8601 | null;
  temp: number | null; rh: number | null;
  nh3: number | null; co2: number | null;
  fanRate: number | null;   // 환기량 = FN1 FAN1 가동률(%) 확정
}
export type RoomsResponse = Record<RoomId, RoomSummary>;
```

### 4.2 `GET /api/main/weather/kma`

```ts
export interface KmaWeather {
  label: '기상청 실황';
  sourceStatus: SourceStatus;
  baseAt: Iso8601 | null;
  weatherCode: WeatherCode | null;
  isNight: boolean;
  windDir: string | null; windDeg: number | null;
  temp: number | null; rh: number | null;
}
```

### 4.3 `GET /api/main/weather/station`

```ts
export interface StationWeather {
  label: '미세기후';
  sourceStatus: SourceStatus;
  measuredAt: Iso8601 | null;
  weatherCode: WeatherCode | null;
  isNight: boolean;
  windDir: string | null; windDeg: number | null;
  temp: number | null; rh: number | null;
  rain: number | null; solar: number | null;
}
```

## 5. 상세 데이터 구조 (current / forecast / expert / control 공통)

응답 구조는 회의에서 우리 쪽이 정하기로 했다(연산 서버 응답 = 03 문서 4.2). 프레임에는 시각별로 바뀌는 값만 담는다(125개 포인트 값, grid 값 2,584개, flowGrid 값 288개). 포인트 좌표와 grid·flowGrid 정의는 고정 형상 정보라 `GET /api/detail/geometry`로 한 번만 받는다.

- 좌표계: 자돈방 바닥 모서리 원점, m, x 길이·y 폭·z 높이(위). Three.js(y-up) 변환은 대시보드.
- 격자 1차원 인덱스: `i + nx * (j + ny * k)`.
- 유동 값: `[vx, vy, vz, value]`, value = 유속 크기(m/s).
- current: 프레임 1개. forecast·expert·control: 10분 간격 145개(0~1,440분).

```ts
export interface GridDef { origin: [number, number, number]; spacing: [number, number, number]; size: [number, number, number] }
export type FlowVec = [number, number, number, number]; // vx, vy, vz, value
export interface DetailFrame {
  offsetMin: number;
  time: Iso8601;
  points: { temp: number[]; rh: number[]; flow: FlowVec[] };  // 125
  grid: { temp: number[]; rh: number[] };                      // nx*ny*nz
  flow: FlowVec[];                                             // flowGrid 노드 수
}
export interface MinMax { min: number; max: number }
export interface Geometry {           // GET /api/detail/geometry, 상세 진입 시 1회
  geometryId: string;                  // 예: 'pig-nh-v1'
  room: { size: [number, number, number] };   // [4.5, 4.0, 2.8]
  points: { id: number; x: number; y: number; z: number }[];  // 125
  grid: GridDef;                       // spacing [0.25,0.25,0.4], size [19,17,8]
  flowGrid: GridDef;                   // origin [0.25,0.25,0.35], spacing [0.5,0.5,0.7], size [9,8,4]
}
export interface DetailBase {
  baseAt: Iso8601;
  intervalMin: 10;
  geometryId: string;                  // 보관한 Geometry와 다르면 geometry 재요청
  range: { temp: MinMax; rh: MinMax; flow: MinMax };  // 전체 프레임 기준
  frames: DetailFrame[];
}
export interface CurrentDetail extends DetailBase { mode: 'current' }
export interface ForecastDetail extends DetailBase { mode: 'forecast' }
export interface ExpertDetail extends DetailBase { mode: 'expert'; input: { temp: number; rh: number; vent: number } }
export interface ControlBlock {
  baselineFanPct: number[];      // 145, frames와 같은 순서
  optimizedFanPct: number[];     // 145
  baselineTMean: number[];       // 145
  optimizedTMean: number[];      // 145
  energyKwh: { baseline: number; optimized: number };
  savingPct: number;
  tMax: { baseline: number; optimized: number };
  constraint: { tMeanMax: number };
}
export interface ControlDetail extends DetailBase { mode: 'control'; target: 'energy' | 'environment'; control: ControlBlock }
```

대시보드는 `frames.length`와 Geometry의 `grid.size`로만 동작(개수 하드코딩 금지).

### `GET /api/detail/geometry`

- 상세 화면 첫 진입 시 1회. 대시보드는 store에 보관하고 다시 요청하지 않는다(상세 응답의 geometryId가 다를 때만 재요청).
- 중계 서버는 `GEOMETRY_FILE`(기본 `./config/geometry.json`)을 그대로 반환. 연산 서버 호출 없음.
- 125개 포인트 좌표는 온도에서 한 번 받아 파일에 넣는다. 받기 전에는 5×5×5 균등 배치 임시값.
- 자돈방 형상(3차원 PINN 자돈사 모델 v17.0, 3D 장면과 mock 생성에 사용):
  - 도메인 4.5(x) × 4.0(y) × 2.8(z) m, 원점 바닥 모서리, z 위쪽
  - 급기구 3개: 천장 z=2.8, 0.32 × 0.687 m
  - 배기구 1개: y=0 벽, 원형 D=0.4 m, 중심 (2.25, 0, 1.6)
  - 칸막이 3개(높이 0.78 m, 두께 0.035 m, Y자): W0 (1.82,0)→(1.82,3.25), W1 (1.82,3.25)→(1.42,4.00), W2 (1.82,3.25)→(2.22,4.00)
  - 급기구 x·y 위치와 센서 8개(F1·J2D·J2U·J1D·J1U·M2·M1·M3) 좌표는 노트북 원본 값 확인 후 `scene/layout.ts`에 반영
- 중계 서버는 연산 서버 응답 배열 개수(125 / 2,584 / 288)가 형상 정보와 다르면 `UPSTREAM_ERROR`.

### 해상도와 표현

- grid: 수평 0.25 m, 높이 0.4 m로 고정. 자돈방 4.5×4.0×2.8 m(PINN 모델 v17.0 형상) 기준 19×17×8 = 2,584 노드, 모든 응답 동일. 대시보드는 2배 삼선형 보간 후 메쉬 생성.
- 온도·습도 메쉬: marching cubes 등치면 3~5단계, 반투명. 프레임별 Web Worker에서 미리 계산·캐시.
- 2D 수평단면: grid에서 `SECTION_Z_M`에 가장 가까운 z층(x·y) → 2배 보간 → 히트맵.
- 유동: flowGrid 노드마다 실린더(InstancedMesh). 방향 [vx, vy, vz], 길이·색상 value. 수평 0.5 m·높이 0.7 m 칸 중앙, 9×8×4 = 288개 고정.
- 응답 크기: 예측 ~100만 개 숫자, ~7 MB JSON → gzip ~2~3 MB. 형상 정보는 응답에 포함하지 않는다.

## 6. 상세 API

| API | 파라미터 | 처리 |
|---|---|---|
| `GET /api/detail/geometry` | 없음 | 형상 파일 반환(상세 진입 시 1회) |
| `GET /api/detail/current` | 없음 | 180분 이력을 5분 간격으로 집계한 37건 → `POST /v1/current`. 끝 시각 단위 캐시 |
| `GET /api/detail/forecast` | 없음 | 실측 37건(current와 같은 구간, 5분 간격) + 단기예보 1시간 TMP·REH를 5분 간격으로 보간한 288건(fan_pct는 외기 기온 규칙으로 계산) = 325건 → `POST /v1/forecast` |
| `GET /api/detail/expert` | `temp`, `rh`, `vent` (필수) | 목업 반환, input 회신. 유효성 검사(숫자·범위·빈 값)는 대시보드 입력 필드에서 하고 통과한 값만 전송, 중계 서버도 같은 범위로 재확인(직접 호출 대비, 위반 시 400) |
| `GET /api/detail/control` | `target` = `energy`(기본) \| `environment` | 목업 반환 |

- current 입력 구간: 이미 완료된 분 중 가장 최근의 10분 단위 정각(00·10·20·30·40·50분)이 끝, 180분 전이 시작. 15:26 → 12:20~15:20, 15:20:30 → 12:10~15:10(15:20분 값이 아직 완료 전). 10분 폴링마다 새 입력으로 연산하고, 같은 10분 구간 안의 재요청만 캐시 응답.
  - 이유: 센서 서버는 1분 안의 측정값을 평균 내 분 단위 값을 만들기 때문에, 현재 분까지 받으면 마지막 값이 비거나 불완전한 평균이 된다. 완료된 10분 정각으로 끊으면 이를 피하고 입력 구간·결과 시각이 폴링 주기와 같은 10분 간격으로 맞는다.
- forecast 입력은 회의 결정 형식. 연동명세서 v1.0 요약 형식과 차이가 있어 확인 중이므로 `FORECAST_INPUT_FORMAT=series|summary` 설정으로 둘 다 만들 수 있게 한다(기본 series). 예보가 24시간을 못 채우면 직전 발표분 재요청, 그래도 부족하면 502. 연속 3시간 이상 결측이거나 조회 자체가 실패하면 "기상청 예보 조회 실패"로 표시하고 연산 서버를 호출하지 않는다(`ApiError`, `source: 'kma'`).
- 연산 대기 중 대시보드는 3D·2D 영역 로딩 표시. `COMPUTE_TIMEOUT_MS` 초과 시 504.

## 7. `GET /api/health`

```ts
export interface Health { relay: SourceStatus; sensor: SourceStatus; kma: SourceStatus; compute: SourceStatus }
```

화면에서 호출하지 않는다. 설치·이관 후 `http://localhost:8080/api/health`를 직접 열어 확인하는 진단용.

## 8. 중계 서버 공통 동작

- 상위 호출은 `Promise.allSettled` 병렬, 개별 타임아웃(`UPSTREAM_TIMEOUT_MS`, 연산 `COMPUTE_TIMEOUT_MS`).
- 기상청 응답은 발표 시각 단위로 메모리 캐시.
- 요청 로그 한 줄(경로, 소요 시간, 상위 서버별 결과) pino.
- 운영 모드에서 `apps/dashboard/dist` 정적 서빙, `/api` 외 경로는 `index.html`.
