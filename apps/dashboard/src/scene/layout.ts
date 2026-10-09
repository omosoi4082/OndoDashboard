// 메인 3D 돈사 치수·배치 상수 (docs/01-functional-spec.md 2장 "3D 모델링 규칙",
// docs/02-relay-api.md 5장 "GET /api/detail/geometry", config/geometry.json 참고).
//
// 자돈방(EX, NH)은 PINN v17.0 실측 형상(config/geometry.json)을 그대로 상수로
// 옮겼다. relay가 이 파일을 GET /api/detail/geometry로 서빙하는 것은 M3 작업이라
// 지금은 같은 실측값을 여기 직접 적어 쓴다(04-tasks.md M3에서 relay 응답을 쓰도록
// 교체 예정).
//
// 2026-10-09 메인 화면(MainScene/OverviewScene)이 프로시저럴 박스 생성 대신 실측
// glb 모델(weaner_room_test-001.glb, scene/barnModel.ts)을 쓰도록 바뀌면서, 아래
// EX_ROOM_FIXTURES/GROWER_ROOM_FIXTURES/FINISHER_ROOM_FIXTURES·RoomLayoutDef·
// PIG_*·MATERIAL_COLORS 등 "박스 생성용" 내용은 더 이상 어디서도 쓰이지 않는다.
// 같이 쓰이던 scene/walls.ts·partitions.ts·roomPlacement.ts·RoomMesh.tsx·
// PigInstances.tsx·pigs.ts·materials.ts는 삭제했다(2026-10-09, 사용자 확인 후).
// 이 파일 자체는 지우지 않고 남겨뒀다 — EX_ROOM_FIXTURES의 치수가 PINN v17.0
// 실측값(05-open-questions.md #18)이라 참고 자료로서 가치가 있다.
import type { RoomId, RoomSummary } from '@ondo/shared';
import type { Vec3 } from './coords.js';

export interface RectFanDef {
  shape: 'rect';
  /** 데이터 좌표(x, y, z), m */
  center: Vec3;
  width: number;
  depth: number;
  thickness: number;
}

export interface CircleFanDef {
  shape: 'circle';
  center: Vec3;
  diameter: number;
  thickness: number;
}

export interface PartitionSegment {
  /** 데이터 좌표계의 x-y 평면 좌표(m) */
  start: readonly [number, number];
  end: readonly [number, number];
}

export interface RoomFixtures {
  /** [x(길이), y(폭), z(높이)] m */
  size: Vec3;
  intakeFans: RectFanDef[];
  exhaustFan: CircleFanDef;
  partitions: { segments: PartitionSegment[]; height: number; thickness: number };
}

// 급기구 사각 팬 두께(천장에 박힌 깊이), 배기구 원형 팬 두께 — 벽/천장에서 튀어나온
// 정도를 표현하기 위한 임시값(실측 없음, 개발자 결정).
const FAN_HOUSING_THICKNESS_M = 0.08;

// 급기구 x·y 위치는 docs/02-relay-api.md "급기구 x·y 위치... 노트북 원본 값 확인 후
// scene/layout.ts에 반영"이라 되어 있듯 아직 미확정(05-open-questions.md #18).
// 천장을 4등분한 지점에 등간격으로 임시 배치한다.
const EX_ROOM_SIZE: Vec3 = [4.5, 4.0, 2.8];
const EX_INTAKE_FAN_WIDTH_M = 0.32;
const EX_INTAKE_FAN_DEPTH_M = 0.687;
const EX_INTAKE_FAN_Y_M = EX_ROOM_SIZE[1] / 2; // TODO(#18): 실측 y 위치로 교체
const EX_INTAKE_FAN_XS_M = [0.75, 2.25, 3.75] as const; // TODO(#18): 실측 x 위치로 교체

export const EX_ROOM_FIXTURES: RoomFixtures = {
  size: EX_ROOM_SIZE,
  intakeFans: EX_INTAKE_FAN_XS_M.map((x) => ({
    shape: 'rect',
    center: [x, EX_INTAKE_FAN_Y_M, EX_ROOM_SIZE[2]],
    width: EX_INTAKE_FAN_WIDTH_M,
    depth: EX_INTAKE_FAN_DEPTH_M,
    thickness: FAN_HOUSING_THICKNESS_M,
  })),
  exhaustFan: {
    shape: 'circle',
    center: [2.25, 0, 1.6],
    diameter: 0.4,
    thickness: FAN_HOUSING_THICKNESS_M,
  },
  partitions: {
    segments: [
      { start: [1.82, 0], end: [1.82, 3.25] },
      { start: [1.82, 3.25], end: [1.42, 4.0] },
      { start: [1.82, 3.25], end: [2.22, 4.0] },
    ],
    height: 0.78,
    thickness: 0.035,
  },
};

/**
 * 치수 미확정인 육성·비육방 형상 — 05-open-questions.md #18에 등재된 미확정 사항이다.
 * 실측값을 받기 전까지 자돈방 형상을 바닥 면적만 균등 비율로 늘린 임시값을 쓴다
 * (칸막이·급기구 비율도 그대로 유지, 천장 높이는 자돈방과 동일하다고 가정).
 * TODO(#18): 온도 제공 실측 치수로 교체.
 */
function scaleRoomFixtures(base: RoomFixtures, scaleXY: number): RoomFixtures {
  const scalePoint = ([x, y, z]: Vec3): Vec3 => [x * scaleXY, y * scaleXY, z];
  const scalePoint2 = ([x, y]: readonly [number, number]): readonly [number, number] => [
    x * scaleXY,
    y * scaleXY,
  ];
  return {
    size: scalePoint(base.size),
    intakeFans: base.intakeFans.map((fan) => ({
      ...fan,
      center: scalePoint(fan.center),
      width: fan.width * scaleXY,
      depth: fan.depth * scaleXY,
    })),
    exhaustFan: {
      ...base.exhaustFan,
      center: scalePoint(base.exhaustFan.center),
      diameter: base.exhaustFan.diameter * scaleXY,
    },
    partitions: {
      ...base.partitions,
      segments: base.partitions.segments.map((seg) => ({
        start: scalePoint2(seg.start),
        end: scalePoint2(seg.end),
      })),
    },
  };
}

// TODO(#18): 임의의 단순 비율(개발자 결정) — 실측 자료 수신 전 임시값.
const GROWER_SCALE_XY = 1.3;
const FINISHER_SCALE_XY = 1.6;

export const GROWER_ROOM_FIXTURES: RoomFixtures = scaleRoomFixtures(EX_ROOM_FIXTURES, GROWER_SCALE_XY);
export const FINISHER_ROOM_FIXTURES: RoomFixtures = scaleRoomFixtures(EX_ROOM_FIXTURES, FINISHER_SCALE_XY);

export interface RoomLayoutDef {
  id: RoomId;
  name: RoomSummary['name'];
  fixtures: RoomFixtures;
  /** 실험군(EX) 자돈방만 true — 호버는 3개 방 모두, 클릭은 이 방만. */
  interactive: boolean;
  /** 문이 복도 쪽이라 90도 회전 배치한다(자돈방만, 01-functional-spec.md 2장). */
  rotated: boolean;
}

export const ROOM_LAYOUT: readonly RoomLayoutDef[] = [
  { id: 'NH', name: '자돈방', fixtures: EX_ROOM_FIXTURES, interactive: true, rotated: true },
  { id: 'GH', name: '육성돈방', fixtures: GROWER_ROOM_FIXTURES, interactive: false, rotated: false },
  { id: 'FH', name: '비육돈방', fixtures: FINISHER_ROOM_FIXTURES, interactive: false, rotated: false },
];

// 복도 폭(방과 방 사이 간격, m) — 평면도 미수신으로 개발자 결정한 임시값.
export const CORRIDOR_GAP_M = 1.2;

// 머티리얼 색상 — 디자인 가이드 미수신(05-open-questions.md #23)이라 임시 색상.
// 실험군(EX)만 컬러, 육성·비육은 축사·돼지 모두 회색("선택 불가" 표시).
export const MATERIAL_COLORS = {
  floor: { interactive: 0xd9b8c9, gray: 0x9aa0a6 },
  wall: { interactive: 0xf1d9e6, gray: 0xc1c5ca },
  fanMetal: 0x8a8f98,
  pig: { interactive: 0xf0a0c0, gray: 0xa9adb3 },
  selectionOutline: 0x2fd3c7,
} as const;

// 돼지 배치 — 두수·크기 비율 모두 미확정 임시값(개발자 결정, TODO).
export const PIG_COUNTS: Record<RoomId, number> = { NH: 20, GH: 12, FH: 8 };
// 자돈 < 육성 < 비육 순으로 커지는 스케일(임시 비율).
export const PIG_SCALE: Record<RoomId, number> = { NH: 0.5, GH: 0.75, FH: 1.0 };
// 성체 비육돈 기준 단일 모델 크기 — [길이, 높이, 폭] m, 추후 glTF 교체 전 임시 형상.
export const PIG_BASE_SIZE: Vec3 = [0.6, 0.3, 0.25];
// 방 벽에서 돼지를 배치하지 않는 여유 간격(m).
export const PIG_WALL_MARGIN_M = 0.3;

// 벽 두께(m) — 평면도 미수신, 개발자 결정 임시값.
export const WALL_THICKNESS_M = 0.12;
export const FLOOR_THICKNESS_M = 0.1;
