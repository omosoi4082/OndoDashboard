// 상세보기 패널(6) 전역 상태 — zustand(CLAUDE.md 규칙). Geometry는 상세 진입 시 1회
// fetch 후 보관하고 다시 요청하지 않는다(docs/02-relay-api.md 5장). 상세 응답의
// geometryId가 보관 중인 값과 다를 때만 재요청하는 트리거는 M4(GET /api/detail/current)에서
// 연결한다 — 비교 로직 자체는 detail/geometryCompare.ts에 순수 함수로 미리 준비해 둔다.
import { create } from 'zustand';
import type { ApiResponse, ControlDetail, CurrentDetail, ExpertDetail, ForecastDetail, Geometry } from '@ondo/shared';
import { advanceTimelineFrame } from '../detail/timeline.js';
import { keepLastGoodOnComputeFailure } from '../detail/keepLastGood.js';
import { formatFrameDateTime } from '../detail/timeline.js';
import { FLOW_PARTICLE_DEFAULT_SPEED, type FlowParticleSpeed } from '../config/constants.js';

// 01-functional-spec.md 1장: 모드 탭(현재/예측/전문가/제어). shared의 각 Detail*의
// mode 리터럴을 그대로 모아 쓴다(타입 복제가 아니라 참조).
export type DetailMode = 'current' | 'forecast' | 'expert' | 'control';

// 10·15·22·29 유동/습도/온도 토글 — 기본값 온도(01-functional-spec.md 3장).
export type ValueField = 'temp' | 'rh' | 'flow';

/** 유동 입자 색 기준(2026-10-26 온도 측 요청 "입자 색을 온도 / 습도 두 가지로") — 기본 온도. */
export type ParticleColorField = 'temp' | 'rh';

export interface DetailState {
  geometry: Geometry | null;
  mode: DetailMode;
  valueField: ValueField;
  particleColorField: ParticleColorField;
  /** 유동 입자 배속(온도 측 샘플 1·3·10배) — 기본 10배. */
  particleSpeed: FlowParticleSpeed;
  /** 11·16·23·30 포인트 on/off — 기본값 on. */
  pointsVisible: boolean;
  /** GET /api/detail/current 응답 — M4. null = 아직 응답을 받지 못함(최초 로딩). */
  current: ApiResponse<CurrentDetail> | null;
  /**
   * 현재 모드 재조회가 연산 서버 실패로 끝나 이전 정상 결과(current)를 유지 중일 때의 오류
   * 문구(2026-10-14 D-4, detail/keepLastGood.ts). null = 유지 중 아님. 다음 응답이 오면
   * 다시 계산된다.
   */
  currentStaleNotice: string | null;
  /**
   * GET /api/detail/forecast 응답(M5) — null = 아직 예측 탭을 선택하지 않았거나 응답이
   * 오기 전(hooks/useForecastDetailOnDemand.ts가 탭 선택 시 1회만 요청해 채운다). 탭을
   * 벗어났다가 돌아와도 재요청하지 않는다(01-functional-spec.md 4.2 "탭 선택 시 1회").
   */
  forecast: ApiResponse<ForecastDetail> | null;
  /**
   * GET /api/detail/expert 응답(M6) — null = 아직 확인 버튼을 누르지 않았거나 응답이 오기
   * 전. 전문가 모드는 "확인 클릭 시"만 요청하므로(01-functional-spec.md 4.3) forecast처럼
   * 탭 선택 자동 요청 훅을 두지 않고 ExpertModeView.tsx가 직접 fetchDetailExpert를 부른다.
   */
  expert: ApiResponse<ExpertDetail> | null;
  /**
   * GET /api/detail/control 응답(M6) — null = 아직 응답이 오기 전. 제어 모드는 "탭 선택
   * 시"와 "최적화 버튼(에너지/환경) 전환 시" 둘 다 재요청한다(01-functional-spec.md 4.4,
   * 예측 모드의 "탭당 1회"와 다른 패턴) — ControlModeView.tsx가 target이 바뀔 때마다
   * fetchDetailControl을 직접 부른다.
   */
  control: ApiResponse<ControlDetail> | null;
  /**
   * 타임라인(17·24·31) 현재 프레임 인덱스 — 예측·전문가·제어 세 모드가 공유한다(한 번에
   * 한 모드만 보이므로 의미상 충돌은 없다). setMode()가 모드를 바꿀 때마다 0으로 리셋한다
   * (다른 모드의 데이터셋인데 재생 위치만 이어지면 혼란스럽다 — 05-open-questions.md #31,
   * 개발자 결정으로 "모드 전환 시 리셋"을 택함).
   */
  timelineFrameIndex: number;
  timelinePlaying: boolean;
  /**
   * 처음부터 다시 시작한 횟수 — 올라갈 때마다 유동 입자를 **빈 방에서 급기구부터** 다시 뿌린다
   * (scene/FlowParticles.tsx). 2026-10-27 사용자: "처음 급기구에서 나오는 게 아니고 나오는 중간
   * 색만 바뀐다". 타임라인만 0으로 되돌리면 입자는 흐르던 자리를 그대로 이어가서,
   * 초기화·모드 전환·분석 항목 전환이 "다시 시작"으로 보이지 않는다.
   */
  timelineRunId: number;

  setGeometry: (geometry: Geometry) => void;
  setMode: (mode: DetailMode) => void;
  setValueField: (field: ValueField) => void;
  setParticleColorField: (field: ParticleColorField) => void;
  setParticleSpeed: (speed: FlowParticleSpeed) => void;
  setPointsVisible: (visible: boolean) => void;
  setCurrent: (current: ApiResponse<CurrentDetail>) => void;
  setForecast: (forecast: ApiResponse<ForecastDetail>) => void;
  /** null을 주면 "입력 전" 상태로 되돌린다 — 전문가 모드 "초기화" 버튼(ExpertModeView.tsx). */
  setExpert: (expert: ApiResponse<ExpertDetail> | null) => void;
  setControl: (control: ApiResponse<ControlDetail>) => void;
  setTimelineFrameIndex: (index: number) => void;
  play: () => void;
  pause: () => void;
  /** 초기화 — 첫 프레임(0)으로 되돌리고 **처음부터 다시 재생한다**(2026-10-27 사용자:
   * "초기화를 누르면 처음부터 재생돼야 한다. 지금은 일시정지와 같다"). 멈추는 건 ⏸가 한다. */
  stop: () => void;
  /** 재생 중 한 틱 전진 — 마지막 프레임이면 그 자리에서 멈춘다(detail/timeline.ts). */
  advanceTimeline: (frameCount: number) => void;
}

/**
 * 모드별 "포인트 표시" 기본값(2026-10-13 온도 측 B-1). 현재 모드는 125개 포인트가 유일한
 * 표현이라 켜 두고, 예측·제어는 등온면·등습면·화살표가 주 표현이라 꺼 둔다
 * (사용자가 켜면 마우스로 값 확인용으로 쓸 수 있다).
 * 전문가 모드도 **기본 꺼짐**이다(2026-10-17 사용자 확정). 새 시안(03_전문가모드_디자인_05)에는
 * 토글이 켜진 상태로 그려져 있어 한때 켜 뒀으나, B-1 원안("예측·전문가·제어 기본 꺼짐")이 맞다.
 */
export function defaultPointsVisible(mode: DetailMode): boolean {
  return mode === 'current';
}

export const useDetailStore = create<DetailState>((set) => ({
  geometry: null,
  mode: 'current',
  valueField: 'temp',
  particleColorField: 'temp',
  particleSpeed: FLOW_PARTICLE_DEFAULT_SPEED,
  pointsVisible: defaultPointsVisible('current'),
  current: null,
  currentStaleNotice: null,
  forecast: null,
  expert: null,
  control: null,
  timelineFrameIndex: 0,
  timelinePlaying: false,
  timelineRunId: 0,

  setGeometry: (geometry) => set({ geometry }),
  // 모드를 바꿀 때마다: ① 유동/습도/온도 토글은 기본값(온도)으로(01-functional-spec.md 3장
  // "기본값 온도") — 안 그러면 이전 모드에서 고른 토글이 새 모드까지 그대로 넘어간다.
  // ② 전문가 모드 결과(expert)는 비운다 — "확인 클릭 시"만 요청하는 모드라 재진입했을 때
  // 이전 세션의 결과가 그대로 남아 있으면 "입력 전 안내" 대신 지난 데이터가 보였다
  // (forecast는 반대로 "탭 선택 시 1회" 캐시가 의도된 동작이라 여기서 건드리지 않는다).
  // (2026-10-10 사용자 확인 — M6까지의 범위에서 나와야 할 버그).
  // ③ 포인트 표시 기본값은 모드마다 다르다(2026-10-13 온도 측 B-1): 예측·전문가·제어는
  // 등온면·등습면·화살표가 주 표현이라 포인트를 켜 두면 가려서 기본 꺼짐이고("'포인트
  // 표시' 토글은 세 모드에도 남겨 두시면 마우스로 값을 확인할 수 있어 좋겠습니다(기본
  // 꺼짐)"), 현재 모드는 포인트가 유일한 표현이라 켜진 상태로 둔다.
  setMode: (mode) =>
    set({
      mode,
      valueField: 'temp',
      // 입자 색도 모드마다 기본(온도)으로 — 습도로 바꾼 채 다른 탭에 가면 그대로 남았다(2026-10-27 사용자).
      particleColorField: 'temp',
      particleSpeed: FLOW_PARTICLE_DEFAULT_SPEED,
      pointsVisible: defaultPointsVisible(mode),
      timelineFrameIndex: 0,
      // 모드에 들어가면 바로 재생한다(2026-10-27 사용자). 입자는 재생 중에만 흐르므로
      // (FlowParticles.tsx) 멈춘 채로 시작하면 유동을 켜도 서 있다. 현재 모드는 타임라인이 없다.
      timelinePlaying: mode !== 'current',
      timelineRunId: 0,
      expert: null,
    }),
  /**
   * 분석 항목 전환 — **온도·습도·유동 어느 것을 눌러도 처음부터 다시 재생한다**(2026-10-27 사용자:
   * "온,습,유동 전부 탭해서 들어가면 리셋되서 처음부터 재생"). 모드 진입도 같다(setMode).
   * 표현이 바뀌면 같은 구간을 처음부터 보게 되고, 입자는 재생 중에만 흐르므로 유동도 바로 돈다.
   * 현재 모드는 타임라인이 없어 영향이 없다.
   */
  setValueField: (field) =>
    set((s) => ({
      valueField: field,
      timelineFrameIndex: s.mode === 'current' ? s.timelineFrameIndex : 0,
      timelinePlaying: s.mode !== 'current',
      timelineRunId: s.timelineRunId + 1,
    })),
  setParticleColorField: (field) => set({ particleColorField: field }),
  setParticleSpeed: (speed) => set({ particleSpeed: speed }),
  setPointsVisible: (visible) => set({ pointsVisible: visible }),
  // 연산 서버 실패 시 이전 정상 결과를 유지할지는 순수 함수로 판단한다(D-4).
  setCurrent: (next) =>
    set((s) => {
      // 유지하는 결과가 언제 값인지 문구에 같이 띄운다(온도 측 2026-10-14 회신).
      const { response, staleNotice } = keepLastGoodOnComputeFailure(s.current, next, (d) =>
        formatFrameDateTime(d.baseAt),
      );
      return { current: response, currentStaleNotice: staleNotice };
    }),
  setForecast: (forecast) => set({ forecast }),
  setExpert: (expert) => set({ expert }),
  setControl: (control) => set({ control }),
  setTimelineFrameIndex: (index) => set({ timelineFrameIndex: index }),
  play: () => set({ timelinePlaying: true }),
  pause: () => set({ timelinePlaying: false }),
  stop: () =>
    set((s) => ({
      timelineFrameIndex: 0,
      timelinePlaying: s.mode !== 'current',
      // 입자도 빈 방에서 급기구부터 다시 — 그래야 "처음부터"가 눈에 보인다(2026-10-27 사용자).
      timelineRunId: s.timelineRunId + 1,
    })),
  advanceTimeline: (frameCount) =>
    set((s) => {
      const result = advanceTimelineFrame(s.timelineFrameIndex, frameCount);
      return { timelineFrameIndex: result.frameIndex, timelinePlaying: result.playing };
    }),
}));
