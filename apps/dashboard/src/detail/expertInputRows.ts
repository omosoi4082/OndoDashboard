// 전문가 모드 입력 표(21, B-2)의 행 라벨과 초기값.
//
// 2026-10-17 새 시안(docs/design/UI/전문가 모드 새 디자인/03_전문가모드_디자인_01~05.png) 반영:
// ① 행 라벨은 "0시 ~ 23시"(하루 절대 시각) 고정이다. 전에는 "현재 시각 다음 정시"부터 1시간
//    간격으로 Date를 만들어 "16:00"처럼 찍었는데, 시안이 0시부터 23시로 못 박았다(사용자 확인).
//    라벨이 더 이상 "지금"에 매이지 않으므로 Date를 들고 있을 이유가 없어 문자열로 단순화했다.
// ② 표는 **빈 칸으로 시작**한다. 전에는 mock_expert.json 정시 값 24개를 예시로 채워 뒀지만,
//    시안은 전 칸이 placeholder("값을 입력해주세요.")이고 "초기화" 버튼도 값을 하나라도 적어야
//    나타난다 — 빈 칸 시작이 의도다(05-open-questions.md #44 "시안이 오면 맞춘다" 종결).
import type { ExpertRowDraft } from './expertInputValidation.js';

/** 행 라벨 "0시" ~ "(count-1)시". 시안 그대로 하루 절대 시각이다. */
export function expertRowLabels(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${i}시`);
}

/** 빈 입력 표 — 모든 칸이 빈 문자열(placeholder가 보이는 상태). */
export function expertEmptyDrafts(count: number): ExpertRowDraft[] {
  return Array.from({ length: count }, () => ({ temp: '', rh: '', vent: '' }));
}

/** 한 칸이라도 값이 들어갔는지 — "초기화" 버튼 노출 조건(시안 02). */
export function hasAnyExpertInput(drafts: readonly ExpertRowDraft[]): boolean {
  return drafts.some((row) => row.temp.trim() !== '' || row.rh.trim() !== '' || row.vent.trim() !== '');
}
