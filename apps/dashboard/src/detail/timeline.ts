// 타임라인(17·24·31) 순수 로직 — 01-functional-spec.md 4.5. 재생 중 프레임 전진/정지
// 판단과 "현재 프레임 시각" 표시용 포맷팅을 컴포넌트(Timeline.tsx)에서 분리해 테스트한다
// (CLAUDE.md 코드 규칙).
export interface TimelineAdvanceResult {
  frameIndex: number;
  playing: boolean;
}

/**
 * 재생 중 한 틱(TIMELINE_FRAME_DURATION_MS)마다 프레임을 1개 전진한다. 마지막 프레임에
 * 도달하면 그 자리에서 재생을 멈춘다(01-functional-spec.md 4.5: 정지 버튼만 "첫 프레임으로"
 * 되돌리고, 끝까지 재생되면 반복 재생 여부가 명세에 없어 가장 단순하게 "끝에서 정지"로 둔다
 * — docs/05-open-questions.md에 항목 추가).
 */
export function advanceTimelineFrame(currentIndex: number, frameCount: number): TimelineAdvanceResult {
  if (frameCount <= 0) return { frameIndex: 0, playing: false };
  const next = currentIndex + 1;
  if (next >= frameCount) return { frameIndex: frameCount - 1, playing: false };
  return { frameIndex: next, playing: true };
}

/** 임의의 인덱스를 0~frameCount-1 범위로 자른다(드래그 입력 등 바깥값 방어). */
export function clampTimelineFrameIndex(index: number, frameCount: number): number {
  if (frameCount <= 0) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), frameCount - 1);
}

/**
 * DetailFrame.time(Iso8601, 항상 "+09:00" 부착— docs/02-relay-api.md 1장)에서 HH:mm만
 * 뽑는다. Date 객체를 거치지 않고 문자열에서 바로 잘라내 로컬 타임존 영향을 없앤다.
 */
export function formatFrameTime(iso: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  return match ? `${match[1]}:${match[2]}` : '-';
}
