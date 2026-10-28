// 상세 패널 카드 안 공통 섹션(docs/06-design-guide.md "상세 패널") — 제목 줄 + 내용 박스.
// 네 모드(DetailPanel·ForecastDetailView·ExpertModeView·ControlModeView)가 같은 틀을 쓴다.
import type { ReactElement, ReactNode } from 'react';
import { History } from 'lucide-react';
import type { DetailFrame } from '@ondo/shared';
import { useDetailStore } from '../../store/detailStore.js';
import { Timeline } from './Timeline.js';
import { FLOW_PARTICLE_SPEEDS, SECTION_Z_MAX_M, SECTION_Z_MIN_M, SECTION_Z_STEP_M } from '../../config/constants.js';

/** 상세 패널 스크롤 영역 — "3D 자돈방"부터 "2D 수평단면"까지만 스크롤되고, 그 위의
 * 분석 항목·시간 설정·전문가 입력폼·제어 토글 같은 버튼류는 스크롤 밖에 고정된다
 * (2026-10-11 사용자: "상세보기 패널 스크롤은 3d구역부터 2d까지만이고 위에 설정하고
 * 클릭하는 버튼들은 스크롤 영역에 안들어가고 고정이야"). 네 모드(DetailPanel·
 * ForecastDetailView·ExpertModeView·ControlModeView) 전부 이 컴포넌트로 3D/2D(또는 로딩·
 * 오류 자리표시자) 부분만 감싼다.
 *
 * overflow-y만 auto로 두면 overflow-x가 'visible'에서 'auto'로 강제 계산되는 CSS 규칙
 * 때문에(두 축 중 하나라도 visible이 아니면 다른 축의 visible도 auto로 바뀐다) 2D 단면
 * 내부 몇 px 오차만으로도 가로 스크롤바가 떴다(2026-10-11 사용자: "가로 스크롤없어") —
 * overflow-x-hidden으로 막는다.
 *
 * 가로 계산(2026-10-28 사용자 "우측 패딩이 좌측과 안 맞는 게 맞춰줘" — 내용 고정폭을 버렸다):
 * 패널 840 − 오른쪽 여백 20(App.tsx pr-5) = 카드 820 − 카드 패딩 10+10 = **안쪽 800**.
 * 3D·2D 내용은 그 800을 그대로 채운다(`w-full`) — 그래서 내용 왼쪽 여백과 오른쪽 여백이
 * 둘 다 카드 패딩 10px로 같고, 위의 모드 탭·분석 항목 줄과도 끝이 맞는다.
 * 전에는 내용이 728 고정폭이라 왼쪽 10 / 오른쪽 30(여백 20 + 패딩 10)으로 어긋나 보였다
 * (2026-10-28 실측: 카드 1132~1900, 3D 박스 1142~1870).
 * 스크롤바가 생기면 그 10px만큼 내용이 줄어든다 — 그때만 오른쪽이 10px 좁아진다.
 * 이전 기록(2026-10-11 사용자 확정 "3d 영역 728이고 영역 끝에서 스크롤까지 10거리가 있어",
 * "스크롤옆 상세패널과에 패딩이 5야")은 카드 패딩이 p-5였던 시절 계산이다.
 * 주의: .ondo-scrollbar는 ::-webkit-scrollbar width:5px를 선언하지만, 같이 선언된 표준
 * scrollbar-width:thin이 우선해 **크롬에서 실제로는 10px**로 그려진다(2026-10-26 실측,
 * 이 변경과 무관하게 전부터 그랬다). 그래서 "스크롤바 5 + 가장자리 5"는 지금 환경에서
 * 성립하지 않는다 — 폭을 진짜 5px로 만들려면 index.css의 scrollbar-width부터 손봐야 한다. */
export function DetailScrollBody({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="ondo-scrollbar flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overflow-x-hidden">
      {children}
    </div>
  );
}

/** 포인트 on/off(11·16·23·30, 기본 on) — 초록 점 + 토글 스위치. */
function PointsToggle(): ReactElement {
  const pointsVisible = useDetailStore((s) => s.pointsVisible);
  const setPointsVisible = useDetailStore((s) => s.setPointsVisible);

  return (
    // 2026-10-26 사용자 지시로 전체 10% 축소: 글자 12 → 11px, 점 8 → 7px, 트랙 24×46 →
    // 22×41, 손잡이 16 → 14px(여백·이동거리는 아래 주석의 계산을 새 치수로 다시 풀었다).
    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-white">
      {/* 점 바깥지름 8px(흰 테두리 1px) + 안쪽 채움 6px — 02_예측모드_디자인_04 실측
          (2026-10-10, "포인트 표시 앞에 원 테두리 디자인 시안엔 있고"). 2026-10-26 10%
          축소로 7px. */}
      <span
        className={`h-[7px] w-[7px] rounded-full border border-white ${pointsVisible ? 'bg-ondo-accent-on' : 'bg-ondo-muted'}`}
      />
      {/* -ml-0.5: 2026-10-26 사용자 지시 "포인트 표시 글쪽으로 2px 이동" — gap-2(8px)는
          점·글자·트랙 모두에 걸리므로 gap은 그대로 두고 글자만 2px 당긴다. 그래서 점↔글자는
          6px가 되고 글자↔트랙 간격(gap 8 + ml-2 8 = 16px)은 그대로다. */}
      <span className="-ml-0.5">포인트 표시</span>
      <input
        type="checkbox"
        role="switch"
        checked={pointsVisible}
        onChange={(e) => setPointsVisible(e.target.checked)}
        className="peer sr-only"
      />
      {/* 트랙 46×24(테두리 rgba(85,85,85,0.3) 포함), 손잡이 16×16, 바깥 여백 4px — Figma node
          374:25487(03_전문가모드_디자인_01, 2026-10-10 재확인본) 실측값. absolute 자식의
          top/left는 테두리를 뺀 안쪽(padding) 기준으로 계산되므로, 테두리 1px만큼 뺀
          3px를 써야 바깥 기준 4px 여백이 맞는다(사용자 확인: "토글 흰색원 중심 안맞아보여").
          2026-10-26 10% 축소 — 같은 규칙으로 다시 계산:
            트랙 22×41(테두리 포함) → 안쪽(padding box) 20×39, 손잡이 14×14
            top/left = (안쪽 높이 20 − 손잡이 14) / 2 = 3px → 바깥 기준으로는 테두리 1px을
              더한 4px(옛 24×46 트랙의 "바깥 4px"과 같은 규칙. 처음 2px로 뒀다가 실측에서
              손잡이 중심이 트랙 중심보다 1px 위여서 3px으로 고쳤다 — 2026-10-10 "토글
              흰색원 중심 안맞아보여"와 같은 함정)
            켜짐 이동거리 = 안쪽 폭 39 − 손잡이 14 − 왼쪽 3 − 오른쪽 3 = 19px
          (실측: 손잡이 중심 y = 트랙 중심 y, 켠 뒤 좌우 여백 3px로 대칭) */}
      <span className="relative ml-2 h-[22px] w-[41px] rounded-full border border-[rgba(85,85,85,0.3)] bg-ondo-border transition-colors peer-checked:bg-ondo-accent-on after:absolute after:left-[3px] after:top-[3px] after:h-[14px] after:w-[14px] after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-[19px]" />
    </label>
  );
}

// 입자·타임라인 배속 — 온도 측 샘플이 쓴 1·3·10배(mock/응답형식_추가안내_v1.3.3.txt).
// 입자 색 토글(온도/습도)은 2026-10-28 없앴다 — 입자 색은 분석 항목을 따른다.
//
// **현재 모드에서는 보이지 않는다**(2026-10-28 사용자: "현재모드에 배속 없이 기본 1로…
// 배속은 타임라인이 있을 때만"). 현재 모드는 한 시각만 보여 주고 타임라인이 없어서, 배속을
// 올려도 바뀌는 건 입자 속도뿐이고 시간이 빨리 흐르는 것처럼 오해할 수 있다. FlowParticles.tsx가
// 현재 모드를 늘 1배로 돌리므로 여기 버튼만 숨긴다.
function ParticleSpeedToggle(): ReactElement | null {
  const mode = useDetailStore((s) => s.mode);
  const speed = useDetailStore((s) => s.particleSpeed);
  const setSpeed = useDetailStore((s) => s.setParticleSpeed);
  if (mode === 'current') return null;
  return (
    <div className="flex items-center gap-2 text-xs text-white">
      배속
      <div className="flex overflow-hidden rounded-md border border-ondo-border">
        {FLOW_PARTICLE_SPEEDS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={speed === v}
            onClick={() => setSpeed(v)}
            className={`h-6 px-3 text-xs transition-colors ${
              speed === v ? 'bg-[#3b3c42] text-white' : 'bg-ondo-surface-2 text-ondo-muted hover:text-white'
            }`}
          >
            {v}배
          </button>
        ))}
      </div>
    </div>
  );
}

// 단면 높이 슬라이더(2026-10-28 사용자: "슬라이드, 배속 버튼 앞에다가") — 끌면 3D의 반투명 테가
// 그 높이로 오르내리고 오른쪽 단면 그림 색이 그 높이 값으로 바뀐다(온도 측 샘플 뷰어 방식).
function SectionHeightSlider(): ReactElement {
  const z = useDetailStore((s) => s.sectionZ);
  const setZ = useDetailStore((s) => s.setSectionZ);
  return (
    <label className="flex items-center gap-2 text-xs text-white">
      단면 높이
      <input
        type="range"
        aria-label="단면 높이"
        min={SECTION_Z_MIN_M}
        max={SECTION_Z_MAX_M}
        step={SECTION_Z_STEP_M}
        value={z}
        onChange={(e) => setZ(Number(e.target.value))}
        className="h-1 w-[110px] cursor-pointer accent-ondo-accent-on"
      />
      <span className="w-[34px] tabular-nums text-ondo-muted">{z.toFixed(1)} m</span>
    </label>
  );
}

function SectionTitle({ title, right }: { title: string; right?: ReactNode }): ReactElement {
  return (
    <div className="flex h-6 shrink-0 items-center justify-between">
      <span className="text-[16px] font-semibold text-[#ccc]">{title}</span>
      {right}
    </div>
  );
}

/** "3D 자돈방"(12·18·25·32) 제목 줄(포인트 토글 포함) + 3D 뷰 박스. 가로는 스크롤 영역을
 * 꽉 채운다(2026-10-28 사용자 — 패널 840 기준 800px). 계산은 DetailScrollBody 주석 참고.
 *
 * 세로는 2026-10-26부터 가변이다(온도 추가요청 레이아웃 (5) "스크롤 없이 한 화면에").
 * 처음엔 아래 "2D 수평단면" 칸과 424 : 240으로 나눠 가졌는데, 2026-10-28 2D 칸을 없애고
 * (단면은 3D 안 오른쪽 범례 아래에 겹친다 — Detail3DView.tsx) **남는 세로를 3D가 전부** 쓴다.
 * min-h는 더 줄면 3D가 쓸모없어지는 하한이고(개발자 결정), 창이 그보다 작으면
 * DetailScrollBody의 overflow-y-auto가 받아 예전처럼 스크롤된다.
 * 안쪽 박스는 h-full + min-h-0 — flex 열에서 h-full은 "남은 높이 전부"로 줄어들고,
 * min-h-0이 없으면 내용 기준 최소 높이(min-height:auto)가 걸려 안 줄어든다. */
export function Detail3DSection({ children }: { children: ReactNode }): ReactElement {
  return (
    <section className="flex min-h-[280px] flex-col gap-2.5" style={{ flex: '424 1 0' }}>
      <SectionTitle
        title="3D 자돈방"
        right={
          /* 단면 높이·배속·포인트 표시 사이 간격 18px (2026-10-27 사용자 "갭을 8씩 더줘"). */
          <div className="flex items-center gap-[18px]">
            <SectionHeightSlider />
            <ParticleSpeedToggle />
            <PointsToggle />
          </div>
        }
      />
      <div className="h-full min-h-0 w-full">{children}</div>
    </section>
  );
}

/** "시간 설정"(17·24·31) + 타임라인, 아래 구분선. 안내 아이콘·호버 동작은 2026-10-11 사용자
 * 지시(아이콘 icons/control/info.png 18×18, "호버시 10분 단위 ui 보이게"), 아이콘과 글씨
 * 사이 6px. "초기화"는 옛 "정지" 버튼이 이름만 바뀐 것(기능은 그대로 stop(): 첫 프레임으로
 * 되돌리고 멈춤). 예측·전문가·제어 세 모드 전부 같은 디자인(사용자 확인).
 *
 * 2026-10-26 사용자 지시로 **2단(2열) 배치**가 됐다 — 전에는 [제목 + ⓘ + (오른쪽) 초기화] /
 * [재생+트랙] / [라벨] 3줄이었는데, 세로를 줄이려고 왼쪽 열에 제목·초기화를, 오른쪽 열에
 * 재생+트랙·라벨을 쌓아 2줄로 만들었다:
 *   시간 설정 ⓘ    [▶]────────────
 *   ↺ 초기화       현재 …      … / …
 * 그래서 "초기화"가 제목 줄에서 빠져 왼쪽 열 아래로 내려왔고(이 파일), 재생·트랙·라벨
 * 묶음은 그대로 Timeline.tsx가 맡는다 — 경계를 옮기지 않은 이유는 Timeline이 이미
 * "재생 컨트롤 + 그 아래 라벨" 한 덩어리라 그 자체가 오른쪽 열이기 때문이다.
 * 왼쪽 열은 justify-between으로 위/아래 끝에 붙여 오른쪽 열의 두 줄과 높이를 맞춘다. */
export function TimelineSection({
  frames,
  elapsedLabels = false,
}: {
  frames: readonly DetailFrame[];
  /** 전문가 모드 전용 — 양 끝 라벨을 "00:00"~"24:00" 경과 시간으로(Timeline.tsx 주석 참고). */
  elapsedLabels?: boolean;
}): ReactElement {
  const stop = useDetailStore((s) => s.stop);
  return (
    <section className="flex shrink-0 items-stretch justify-between gap-2.5 border-b border-ondo-border pb-2.5">
      {/* 왼쪽 열 — 위: 제목 / 아래: 초기화. ⓘ 안내 아이콘은 2026-10-26 사용자 지시로
          오른쪽 열 아래 줄의 "현재 …" 라벨 옆으로 옮겼다(Timeline.tsx). */}
      <div className="flex shrink-0 flex-col justify-between">
        {/* 높이를 재생 버튼(27px)과 맞춰 제목과 버튼의 세로 중심이 같은 줄에 오게 한다. */}
        <div className="flex h-[27px] shrink-0 items-center">
          <span className="text-[16px] font-semibold text-[#ccc]">시간 설정</span>
        </div>
        {/* 2026-10-26 사용자 지시로 10% 축소: 글자 14 → 13px, 아이콘 20 → 18px.
            아이콘↔글자 간격 4px·색·굵기·위치(왼쪽 열 아래)는 그대로. */}
        <button
          type="button"
          onClick={stop}
          className="flex items-center gap-1 text-[13px] font-medium text-[#a4abb5] transition-colors hover:text-white"
        >
          <History size={18} />
          초기화
        </button>
      </div>
      <Timeline frames={frames} elapsedLabels={elapsedLabels} />
    </section>
  );
}
