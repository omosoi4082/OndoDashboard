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

/**
 * 재생 중 프레임 하나를 보여 주는 시간(ms) = 기본 간격 ÷ 배속. 온도 측 샘플 뷰어는 시계 하나를
 * `실제 경과 × 배속`으로 돌려 타임라인·유동장·입자가 같이 빨라진다(2026-10-28 사용자).
 * 입자도 같은 배속으로 움직이므로(FlowParticles.tsx) 둘의 비율이 배속과 상관없이 같다.
 */
export function timelineTickMs(speed: number, baseMs: number): number {
  return speed > 0 ? baseMs / speed : baseMs;
}

/** 임의의 인덱스를 0~frameCount-1 범위로 자른다(드래그 입력 등 바깥값 방어). */
export function clampTimelineFrameIndex(index: number, frameCount: number): number {
  if (frameCount <= 0) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), frameCount - 1);
}

/**
 * 타임라인 바 위 1시간 단위 점 표시용 인덱스(0, framesPerHour, 2*framesPerHour, ...)
 * (2026-10-10 Figma node 374:23156 실측 — 10분 간격 프레임이라 1시간 = 6프레임마다 하나).
 */
export function hourTickIndices(frameCount: number, framesPerHour = 6): number[] {
  if (frameCount <= 0 || framesPerHour <= 0) return [];
  const ticks: number[] = [];
  for (let i = 0; i < frameCount; i += framesPerHour) {
    ticks.push(i);
  }
  return ticks;
}

/**
 * DetailFrame.time(Iso8601, 항상 "+09:00" 부착— docs/02-relay-api.md 1장)에서 HH:mm만
 * 뽑는다. Date 객체를 거치지 않고 문자열에서 바로 잘라내 로컬 타임존 영향을 없앤다.
 */
export function formatFrameTime(iso: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  return match ? `${match[1]}:${match[2]}` : '-';
}

/**
 * 타임라인 양 끝 라벨용 — 날짜까지 포함한 "MM/DD HH:mm"(2026-10-13 온도 측 B-7:
 * "슬라이더 양 끝을 00:00~24:00(경과 시간)이 아니라 frames[i].time의 실제 시각(날짜 포함)
 * 으로 표시"). 예측 구간은 24시간이라 끝 시각이 다음 날로 넘어가므로 날짜가 필요하다.
 * formatFrameTime과 같은 이유로 문자열에서 바로 잘라낸다(로컬 타임존 영향 없음).
 */
export function formatFrameDateTime(iso: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  return match ? `${match[1]}/${match[2]} ${match[3]}:${match[4]}` : '-';
}

/**
 * 프레임 번호 → 경과 시간 "HH:mm"(전문가 모드 타임라인 라벨, 2026-10-17 시안 05).
 * 프레임 간격은 10분 고정(docs/02-relay-api.md 5장 intervalMin: 10)이라 145프레임이면
 * 0 → "00:00", 144 → "24:00"이 된다. 24시간을 넘겨도 시를 그대로 늘려 찍는다.
 */
export function formatElapsedFrameTime(frameIndex: number, intervalMin = 10): string {
  const total = Math.max(0, Math.round(frameIndex)) * intervalMin;
  const hh = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const mm = (total % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}
