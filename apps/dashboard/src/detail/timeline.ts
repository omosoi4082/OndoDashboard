// 타임라인(17·24·31) 순수 로직 — 01-functional-spec.md 4.5. 재생 중 프레임 전진/정지
// 판단과 "현재 프레임 시각" 표시용 포맷팅을 컴포넌트(Timeline.tsx)에서 분리해 테스트한다
// (CLAUDE.md 코드 규칙).
export interface TimelineAdvanceResult {
  frameIndex: number;
  playing: boolean;
}

/**
 * 재생 중 프레임을 `steps`개 전진한다. 마지막 프레임에 도달하면 그 자리에서 재생을 멈춘다
 * (01-functional-spec.md 4.5: 정지 버튼만 "첫 프레임으로" 되돌리고, 끝까지 재생되면 반복 재생
 * 여부가 명세에 없어 가장 단순하게 "끝에서 정지"로 둔다 — docs/05-open-questions.md에 항목 추가).
 *
 * `steps`는 timelineCatchupSteps가 실제 경과 시간에서 뽑아 준다. 예전엔 틱마다 무조건 1개씩
 * 전진했는데, 10배(틱 50ms)에서는 3D 한 프레임 그리는 시간이 틱보다 길어 타이머가 밀렸고
 * 결국 "배속이 아니라 렌더 속도"가 재생 속도를 정해 버렸다(2026-10-30 온도 측 자동 점검
 * B-3-12 실패 — 2초 동안 1배 5프레임 / 10배 14프레임, 10배가 2.8배밖에 안 나왔다).
 */
export function advanceTimelineFrame(
  currentIndex: number,
  frameCount: number,
  steps = 1,
): TimelineAdvanceResult {
  if (frameCount <= 0) return { frameIndex: 0, playing: false };
  const next = currentIndex + Math.max(Math.trunc(steps), 1);
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

export interface TimelineCatchup {
  /** 이번에 전진할 프레임 수(0이면 아직 한 프레임도 안 지났다). */
  steps: number;
  /** 아직 한 프레임이 안 된 나머지 시간(ms) — 다음 틱 계산에 더해 드리프트를 막는다. */
  remainderMs: number;
}

/**
 * 실제 경과 시간(`elapsedMs`)에서 전진할 프레임 수를 뽑는다. 타이머가 제때 못 울려도
 * 벽시계 기준으로는 배속대로 흐르게 하는 "따라잡기" 계산이다 — 틱 간격보다 오래 밀렸으면
 * 그만큼 여러 프레임을 한 번에 건너뛴다(2026-10-30 B-3-12).
 *
 * `maxCatchupMs`는 한 번에 따라잡을 실제 경과 시간의 상한이다. 탭을 한참 가려 두면 브라우저가
 * setInterval을 초당 1회까지 늦추는데, 그 사이 밀린 시간을 전부 따라잡으면 돌아오자마자
 * 타임라인이 끝으로 순간이동한다. 상한을 두면 "가려 둔 동안은 거의 멈춰 있다 돌아와서 이어
 * 재생"이 된다(1초 상한이면 1배에서 최대 2프레임, 10배에서 최대 20프레임).
 */
export function timelineCatchupSteps(
  elapsedMs: number,
  tickMs: number,
  maxCatchupMs: number,
): TimelineCatchup {
  if (!(tickMs > 0) || !(elapsedMs > 0)) return { steps: 0, remainderMs: 0 };
  const capped = Math.min(elapsedMs, maxCatchupMs);
  const steps = Math.floor(capped / tickMs);
  // 상한에 걸려 잘려 나간 시간은 나머지로 넘기지 않는다 — 넘기면 결국 다음 틱에서 다 따라잡는다.
  return { steps, remainderMs: capped - steps * tickMs };
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
