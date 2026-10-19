// 전문가 모드 입력 표(21, B-2)의 행 라벨과 초기값.
//
// 2026-10-17 새 시안(docs/design/UI/전문가 모드 새 디자인/03_전문가모드_디자인_01~05.png) 반영:
// ① 행 라벨은 "0시 ~ 23시"(하루 절대 시각) 고정이다. 전에는 "현재 시각 다음 정시"부터 1시간
//    간격으로 Date를 만들어 "16:00"처럼 찍었는데, 시안이 0시부터 23시로 못 박았다(사용자 확인).
//    라벨이 더 이상 "지금"에 매이지 않으므로 Date를 들고 있을 이유가 없어 문자열로 단순화했다.
// ② 표는 **빈 칸으로 시작**한다. 전에는 mock_expert.json 정시 값 24개를 예시로 채워 뒀지만,
//    시안은 전 칸이 placeholder("값을 입력해주세요.")이고 "초기화" 버튼도 값을 하나라도 적어야
//    나타난다 — 빈 칸 시작이 의도다(05-open-questions.md #44 "시안이 오면 맞춘다" 종결).
// ③ 2026-10-19 온도 측 승인으로, 표가 **비어 있을 때만** 그 빈 `초기화` 자리에 `예시값` 버튼을
//    둔다(#52 종결). 값이 들어가면 시안대로 `초기화`로 바뀌므로 버튼 수는 늘지 않는다.
//    예시값은 아래 `EXPERT_EXAMPLE_ROWS`.
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

/**
 * "예시값" 버튼이 채우는 24행(2026-10-19 온도 측 제공).
 *
 * 경위(05-open-questions.md #52): 빈 칸으로 시작하는 시안 때문에 `적용`을 누르려면 72칸을 손으로
 * 채워야 해서, "표가 비었을 때만 `초기화` 자리에 `예시값` 버튼"을 제안해 승인받았다
 * (`docs/replies/20261017-확인요청.md` 2번 → 2026-10-19 회신).
 *
 * 숫자 출처: 온도 측이 함께 보낸 `mock/전문가모드_예시값_24행x3열.csv`로,
 * 새 `mock/mock_expert.json`(v4) `input`의 **정시 값 24개**다 — 제주 농장 실측 폭염일
 * (2026-08-03~04) 기상대·환기팬 측정값이라 이 값으로 적용하면 목업 결과와 입력이 맞아떨어진다.
 * 1행이 원자료에서는 "현재 시각 다음 정시"지만, 표 라벨은 `0시~23시` 고정이라(#51) 행 라벨과
 * 값의 원래 시각은 어긋난다 — "예시값"이므로 무시한다(2026-10-14 같은 판단).
 *
 * 입력칸은 문자열을 다루므로(ExpertRowDraft) 소수점 표기를 그대로 보존하려고 문자열로 적는다.
 */
export const EXPERT_EXAMPLE_ROWS: readonly ExpertRowDraft[] = [
  { temp: '32.4', rh: '68.3', vent: '100' },
  { temp: '32.5', rh: '69.9', vent: '100' },
  { temp: '33.0', rh: '59.6', vent: '100' },
  { temp: '32.2', rh: '58.7', vent: '100' },
  { temp: '30.4', rh: '68.4', vent: '100' },
  { temp: '27.6', rh: '74.1', vent: '100' },
  { temp: '27.6', rh: '72.2', vent: '100' },
  { temp: '27.0', rh: '74.9', vent: '100' },
  { temp: '26.6', rh: '76.7', vent: '100' },
  { temp: '26.2', rh: '78.3', vent: '65' },
  { temp: '26.4', rh: '80.1', vent: '73' },
  { temp: '26.7', rh: '80.9', vent: '94' },
  { temp: '26.2', rh: '81.9', vent: '100' },
  { temp: '26.3', rh: '82.0', vent: '92' },
  { temp: '26.2', rh: '81.2', vent: '83' },
  { temp: '26.3', rh: '80.8', vent: '93' },
  { temp: '26.8', rh: '81.0', vent: '76' },
  { temp: '27.3', rh: '88.0', vent: '100' },
  { temp: '28.8', rh: '82.5', vent: '67' },
  { temp: '30.4', rh: '75.4', vent: '100' },
  { temp: '31.4', rh: '70.4', vent: '100' },
  { temp: '31.7', rh: '69.2', vent: '100' },
  { temp: '32.0', rh: '69.1', vent: '100' },
  { temp: '31.5', rh: '71.0', vent: '100' },
];

/**
 * 예시값으로 채운 입력 표. 행 수가 예시값 개수(24)와 다르면 모자란 행은 빈 칸으로 둔다
 * (행 수는 `EXPERT_INPUT_ROW_COUNT` 상수라 어긋날 일이 없지만, 값 개수에 화면을 매지 않는다).
 */
export function expertExampleDrafts(count: number): ExpertRowDraft[] {
  return Array.from({ length: count }, (_, i) => {
    const row = EXPERT_EXAMPLE_ROWS[i];
    return row ? { ...row } : { temp: '', rh: '', vent: '' };
  });
}
