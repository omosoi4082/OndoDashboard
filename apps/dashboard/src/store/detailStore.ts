// 상세보기 패널(6) 전역 상태 — zustand(CLAUDE.md 규칙). Geometry는 상세 진입 시 1회
// fetch 후 보관하고 다시 요청하지 않는다(docs/02-relay-api.md 5장). 상세 응답의
// geometryId가 보관 중인 값과 다를 때만 재요청하는 트리거는 M4(GET /api/detail/current)에서
// 연결한다 — 비교 로직 자체는 detail/geometryCompare.ts에 순수 함수로 미리 준비해 둔다.
import { create } from 'zustand';
import type { ApiResponse, ControlDetail, CurrentDetail, ExpertDetail, ForecastDetail, Geometry } from '@ondo/shared';
import { advanceTimelineFrame } from '../detail/timeline.js';

// 01-functional-spec.md 1장: 모드 탭(현재/예측/전문가/제어). shared의 각 Detail*의
// mode 리터럴을 그대로 모아 쓴다(타입 복제가 아니라 참조).
export type DetailMode = 'current' | 'forecast' | 'expert' | 'control';

// 10·15·22·29 유동/습도/온도 토글 — 기본값 온도(01-functional-spec.md 3장).
export type ValueField = 'temp' | 'rh' | 'flow';

export interface DetailState {
  geometry: Geometry | null;
  mode: DetailMode;
  valueField: ValueField;
  /** 11·16·23·30 포인트 on/off — 기본값 on. */
  pointsVisible: boolean;
  /** GET /api/detail/current 응답 — M4. null = 아직 응답을 받지 못함(최초 로딩). */
  current: ApiResponse<CurrentDetail> | null;
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

  setGeometry: (geometry: Geometry) => void;
  setMode: (mode: DetailMode) => void;
  setValueField: (field: ValueField) => void;
  setPointsVisible: (visible: boolean) => void;
  setCurrent: (current: ApiResponse<CurrentDetail>) => void;
  setForecast: (forecast: ApiResponse<ForecastDetail>) => void;
  /** null을 주면 "입력 전" 상태로 되돌린다 — 전문가 모드 "초기화" 버튼(ExpertModeView.tsx). */
  setExpert: (expert: ApiResponse<ExpertDetail> | null) => void;
  setControl: (control: ApiResponse<ControlDetail>) => void;
  setTimelineFrameIndex: (index: number) => void;
  play: () => void;
  pause: () => void;
  /** 정지 — 첫 프레임(0)으로 되돌리고 재생을 멈춘다(01-functional-spec.md 4.5). */
  stop: () => void;
  /** 재생 중 한 틱 전진 — 마지막 프레임이면 그 자리에서 멈춘다(detail/timeline.ts). */
  advanceTimeline: (frameCount: number) => void;
}

export const useDetailStore = create<DetailState>((set) => ({
  geometry: null,
  mode: 'current',
  valueField: 'temp',
  pointsVisible: true,
  current: null,
  forecast: null,
  expert: null,
  control: null,
  timelineFrameIndex: 0,
  timelinePlaying: false,

  setGeometry: (geometry) => set({ geometry }),
  // 모드를 바꿀 때마다: ① 유동/습도/온도 토글은 기본값(온도)으로(01-functional-spec.md 3장
  // "기본값 온도") — 안 그러면 이전 모드에서 고른 토글이 새 모드까지 그대로 넘어간다.
  // ② 전문가 모드 결과(expert)는 비운다 — "확인 클릭 시"만 요청하는 모드라 재진입했을 때
  // 이전 세션의 결과가 그대로 남아 있으면 "입력 전 안내" 대신 지난 데이터가 보였다
  // (forecast는 반대로 "탭 선택 시 1회" 캐시가 의도된 동작이라 여기서 건드리지 않는다).
  // (2026-10-10 사용자 확인 — M6까지의 범위에서 나와야 할 버그).
  setMode: (mode) => set({ mode, valueField: 'temp', timelineFrameIndex: 0, timelinePlaying: false, expert: null }),
  setValueField: (field) => set({ valueField: field }),
  setPointsVisible: (visible) => set({ pointsVisible: visible }),
  setCurrent: (current) => set({ current }),
  setForecast: (forecast) => set({ forecast }),
  setExpert: (expert) => set({ expert }),
  setControl: (control) => set({ control }),
  setTimelineFrameIndex: (index) => set({ timelineFrameIndex: index }),
  play: () => set({ timelinePlaying: true }),
  pause: () => set({ timelinePlaying: false }),
  stop: () => set({ timelineFrameIndex: 0, timelinePlaying: false }),
  advanceTimeline: (frameCount) =>
    set((s) => {
      const result = advanceTimelineFrame(s.timelineFrameIndex, frameCount);
      return { timelineFrameIndex: result.frameIndex, timelinePlaying: result.playing };
    }),
}));
