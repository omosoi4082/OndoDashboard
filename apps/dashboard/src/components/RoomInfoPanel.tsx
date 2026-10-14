// 메인 3D 방 마커(01-functional-spec.md 2장 #4·#5, 05-open-questions.md #35) — 방마다
// 항상 떠 있는 이름표와, 호버했을 때 그 자리에서 펼쳐지는 정보 판넬(5-1~5-3)이다.
// 둘은 같은 앵커를 쓴다: 방 중심에 원형 마커가 놓이고, 그 오른쪽으로 이름표(알약) 또는
// 정보 카드가 붙는다. 환기량은 FAN1 가동률(%)만 쓴다(FAN2·FAN3 금지).
//
// 디자인 원본(2026-10-14 전달): docs/design/UI/자돈방이름표.png·자돈방호버.png,
// 육성,비육돈방이름표.png·육성,비육돈방호버.png, 원형 효과는 자돈방원형 효과.png·
// 육성,비육돈방 원형효과.png. 색·치수는 그 PNG에서 실측했고(아래 주석), 글자 크기·여백은
// 2026-10-14 사용자 지정값을 따른다.
import type { ReactElement, ReactNode } from 'react';
import type { RoomId, RoomSummary } from '@ondo/shared';

/**
 * 자돈방(NH)은 초록, 육성·비육(GH·FH)은 회색이다 — 메인 화면에서 클릭 가능한 방과
 * 아닌 방을 색으로 구분하는 기존 규칙(01-functional-spec.md 2장)과 같은 구분이다.
 */
type RoomMarkerVariant = 'primary' | 'muted';

function roomMarkerVariant(roomId: RoomId): RoomMarkerVariant {
  return roomId === 'NH' ? 'primary' : 'muted';
}

// PNG 실측값. 원형 효과(Figma 캡처)는 양쪽 모두 "fill 10% + stroke 100% inside 1.5 +
// drop shadow blur 20"이고, 자돈방만 그림자 색이 #2AF5C0(초록보다 밝은 민트)이다.
// 알약·카드 배경은 같은 색의 투명도만 다르다(이름표 70%, 호버 카드 80%/85%).
const VARIANT_STYLE: Record<RoomMarkerVariant, {
  ring: string;
  glow: string;
  dot: string;
  border: string;
  labelBg: string;
  cardBg: string;
  text: string;
}> = {
  primary: {
    ring: '#00BD55',
    glow: '#2AF5C0',
    dot: '#00BD55',
    border: '#2AF5C0',
    labelBg: 'rgba(26, 109, 60, 0.7)',
    cardBg: 'rgba(26, 107, 60, 0.8)',
    text: '#FFFFFF',
  },
  muted: {
    ring: '#888888',
    glow: '#888888',
    dot: '#888888',
    border: '#555555',
    labelBg: 'rgba(52, 52, 52, 0.7)',
    cardBg: 'rgba(50, 50, 50, 0.85)',
    text: '#DBDBDB',
  },
};

// 2026-10-14 사용자 지정: 방 이름은 이름표·호버 카드 둘 다 16px(원본 PNG에서도 같은
// 크기였다). 이름표 패딩 4/8, 호버 카드 정보 12px·단위 8px·라운드 4·패딩 위 4 좌우·아래 8·
// 제목과 정보 사이 8·정보 사이 8.
const ROOM_NAME_FONT_PX = 16;

// 원형 마커(바깥 20px, 안쪽 점 12px)와 글상자 사이 간격 8px — PNG 실측(원 오른쪽 끝
// x=39, 상자 왼쪽 끝 x=48).
const CIRCLE_PX = 20;
const CIRCLE_DOT_PX = 12;
const CIRCLE_GAP_PX = 8;
const BOX_PADDING_TOP_PX = 4;

/**
 * 글상자 위쪽 여백 — 상자의 첫 줄(이름)이 원형 마커 중앙과 같은 높이에 오게 끌어올린다.
 * 원 중심은 상자 맨 위에서 CIRCLE_PX/2, 첫 줄 중심은 (패딩 + 글자 크기/2)에 있다.
 */
function boxOffsetY(fontPx: number): number {
  return CIRCLE_PX / 2 - (BOX_PADDING_TOP_PX + fontPx / 2);
}

function RoomMarkerCircle({ variant }: { variant: RoomMarkerVariant }): ReactElement {
  const s = VARIANT_STYLE[variant];
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: CIRCLE_PX,
        height: CIRCLE_PX,
        backgroundColor: `color-mix(in srgb, ${s.ring} 10%, transparent)`,
        border: `1.5px solid ${s.ring}`,
        boxShadow: `0 0 20px ${s.glow}`,
      }}
    >
      <div
        className="rounded-full"
        style={{ width: CIRCLE_DOT_PX, height: CIRCLE_DOT_PX, backgroundColor: s.dot }}
      />
    </div>
  );
}

/**
 * 원형 마커 + 글상자 공통 껍데기. drei <Html>은 자식의 좌상단을 투영 지점에 두므로,
 * **원의 중심**이 방 중심(앵커)에 오도록 전체를 -CIRCLE_PX/2 만큼 당긴다.
 */
function RoomMarkerShell({
  variant,
  offsetY,
  children,
}: {
  variant: RoomMarkerVariant;
  offsetY: number;
  children: ReactNode;
}): ReactElement {
  return (
    <div
      className="pointer-events-none flex w-max items-start"
      style={{ gap: CIRCLE_GAP_PX, transform: `translate(${-CIRCLE_PX / 2}px, ${-CIRCLE_PX / 2}px)` }}
    >
      <RoomMarkerCircle variant={variant} />
      <div style={{ marginTop: offsetY }}>{children}</div>
    </div>
  );
}

/** 방 이름표 — 호버하지 않은 방에 항상 떠 있다(방 중심). */
export function RoomNameLabel({ roomId, name }: { roomId: RoomId; name: string }): ReactElement {
  const variant = roomMarkerVariant(roomId);
  const s = VARIANT_STYLE[variant];
  return (
    <RoomMarkerShell variant={variant} offsetY={boxOffsetY(ROOM_NAME_FONT_PX)}>
      <div
        className="whitespace-nowrap rounded font-semibold leading-none"
        style={{
          padding: `${BOX_PADDING_TOP_PX}px 8px`,
          fontSize: ROOM_NAME_FONT_PX,
          backgroundColor: s.labelBg,
          border: `1px solid ${s.border}`,
          color: s.text,
        }}
      >
        {name}
      </div>
    </RoomMarkerShell>
  );
}

/**
 * 정보 판넬(5-1~5-3) — 호버한 방에만, 이름표와 같은 자리에 펼쳐진다. 값이 없으면 '-'
 * (01-functional-spec.md 2장). 소수점은 디자인 시안대로 온도만 한 자리, 나머지는 정수다.
 */
const INFO_ROWS: readonly { label: string; key: keyof Pick<RoomSummary, 'temp' | 'rh' | 'fanRate' | 'nh3' | 'co2'>; unit: string; digits: number }[] = [
  { label: '온도', key: 'temp', unit: '℃', digits: 1 },
  { label: '습도', key: 'rh', unit: '%', digits: 0 },
  { label: '환기량', key: 'fanRate', unit: '%', digits: 0 },
  { label: 'NH3', key: 'nh3', unit: 'ppm', digits: 0 },
  { label: 'CO2', key: 'co2', unit: 'ppm', digits: 0 },
];

interface RoomInfoPanelProps {
  roomId: RoomId;
  summary: RoomSummary | null;
}

export function RoomInfoPanel({ roomId, summary }: RoomInfoPanelProps): ReactElement {
  const variant = roomMarkerVariant(roomId);
  const s = VARIANT_STYLE[variant];
  const name = summary?.name ?? roomId;

  return (
    <RoomMarkerShell variant={variant} offsetY={boxOffsetY(ROOM_NAME_FONT_PX)}>
      <div
        className="whitespace-nowrap rounded"
        style={{
          padding: `${BOX_PADDING_TOP_PX}px 8px 8px`,
          backgroundColor: s.cardBg,
          border: `1px solid ${s.border}`,
          color: s.text,
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-semibold leading-none" style={{ fontSize: ROOM_NAME_FONT_PX }}>
            {name}
          </span>
          {/* 디자인 시안에는 없지만 끊김 표시는 명세 요구사항이다(01-functional-spec.md 2장). */}
          {summary?.sourceStatus === 'disconnected' && (
            <span className="rounded bg-red-500/20 px-1 py-0.5 text-[10px] leading-none text-red-300">끊김</span>
          )}
        </div>

        <dl className="mt-2 flex flex-col gap-2 text-[12px] leading-none">
          {INFO_ROWS.map((row) => {
            const value = summary?.[row.key] ?? null;
            return (
              <div key={row.label} className="flex items-center gap-1.5">
                {/* 값 왼쪽의 작은 세로 막대(2×8px) — 자돈방·육성·비육 모두 민트색이다(PNG 실측). */}
                <span className="shrink-0" style={{ width: 2, height: 8, backgroundColor: '#2AF5C0' }} />
                <dt>{row.label} :</dt>
                <dd className="flex items-baseline">
                  <span>{value === null ? '-' : value.toFixed(row.digits)}</span>
                  {value !== null && (
                    <span className="text-[8px] opacity-50">{row.unit}</span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </RoomMarkerShell>
  );
}
