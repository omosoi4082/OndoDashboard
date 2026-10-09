// docs/03-upstream-apis.md 1.2 "5분 집계·결측 처리"(A안 확정 2026-10-08). 181개(1분, 결측은
// null, 반올림 금지) → 37개(5분). 4단계를 각각 순수 함수로 분리하고 단위 테스트한다.
// T_out·RH_out·fan_pct 세 항목 모두 같은 함수를 쓴다.

export interface AggregateThresholds {
  interpMaxGap: number; // AGG_INTERP_MAX_GAP: 연속 결측이 이 값 이하면 보간
  errorMinGap: number; // AGG_ERROR_MIN_GAP: 연속 결측이 이 값 이상이면 센서 오류
  errorMaxRatio: number; // AGG_ERROR_MAX_RATIO: 37건 중 결측 비율이 이 값 초과면 센서 오류
  rangeMin: number;
  rangeMax: number;
}

const FIVE_MIN_MARK_COUNT = 37;
const ONE_MIN_PER_FIVE_MIN = 5;

function average(values: readonly number[]): number {
  // 반올림 금지(docs/03 1.2 1단계) — 그대로 합/개수.
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * 1단계: 5분 마크 t(00·05·…) 값 = 1분값 t−4..t의 평균(null 제외, 전부 null이면 null).
 * 입력 배열은 181개(구간 시작~끝, 1분 간격)를 기대하며, 마크 위치는 입력 배열의 인덱스
 * 0, 5, 10, ... (구간 시작 기준 오프셋)이다. 구간 맨 앞 마크는 t−4 쪽이 입력 배열 밖(구간
 * 시작 이전)이라 가용한 값만으로 평균한다(평균 창을 구간 안으로 clamp).
 */
export function aggregateToFiveMinute(oneMin: readonly (number | null)[]): (number | null)[] {
  const result: (number | null)[] = [];
  for (let mark = 0; mark < FIVE_MIN_MARK_COUNT; mark += 1) {
    const p = mark * ONE_MIN_PER_FIVE_MIN;
    const from = Math.max(0, p - (ONE_MIN_PER_FIVE_MIN - 1));
    const slice = oneMin.slice(from, p + 1);
    const valid = slice.filter((v): v is number => v !== null);
    result.push(valid.length > 0 ? average(valid) : null);
  }
  return result;
}

/**
 * 2단계: 연속 결측이 maxGap 이하면 앞뒤 값으로 선형 보간. 구간 맨 앞/뒤라 한쪽 값이 없으면
 * (연속 결측이 maxGap 이하일 때만) 가장 가까운 값을 복사한다.
 */
export function interpolateShortGaps(values: readonly (number | null)[], maxGap: number): (number | null)[] {
  const result: (number | null)[] = [...values];
  const n = result.length;
  let i = 0;
  while (i < n) {
    if ((result[i] ?? null) !== null) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < n && (result[j] ?? null) === null) j += 1;
    const gapLen = j - i;
    if (gapLen <= maxGap) {
      const leftVal: number | null = i > 0 ? (result[i - 1] ?? null) : null;
      const rightVal: number | null = j < n ? (result[j] ?? null) : null;
      for (let k = i; k < j; k += 1) {
        if (leftVal !== null && rightVal !== null) {
          const t = (k - i + 1) / (gapLen + 1);
          result[k] = leftVal + (rightVal - leftVal) * t;
        } else if (leftVal !== null) {
          result[k] = leftVal;
        } else if (rightVal !== null) {
          result[k] = rightVal;
        }
        // leftVal·rightVal 둘 다 없으면(37개 전부 null 등) null 유지 — 3단계에서 오류 처리.
      }
    }
    i = j;
  }
  return result;
}

export interface GapInfo {
  maxConsecutiveGap: number;
  missingCount: number; // 결측 슬롯 수(5분 단위 배열 기준)
  ratio: number; // missingCount / 전체
}

/** 3단계 판정에 쓰는 결측 구간 통계. */
export function analyzeGaps(values: readonly (number | null)[]): GapInfo {
  let maxGap = 0;
  let curGap = 0;
  let missing = 0;
  for (const v of values) {
    if (v === null) {
      curGap += 1;
      missing += 1;
      if (curGap > maxGap) maxGap = curGap;
    } else {
      curGap = 0;
    }
  }
  return { maxConsecutiveGap: maxGap, missingCount: missing, ratio: values.length > 0 ? missing / values.length : 0 };
}

/** 3단계: 연속 결측 ≥ errorMinGap, 또는 결측 비율 > errorMaxRatio면 센서 오류. */
export function isSensorError(
  info: GapInfo,
  thresholds: Pick<AggregateThresholds, 'errorMinGap' | 'errorMaxRatio'>,
): boolean {
  return info.maxConsecutiveGap >= thresholds.errorMinGap || info.ratio > thresholds.errorMaxRatio;
}

/** 4단계: 범위 밖 값은 null로 본다(보간·오류 판정은 호출부에서 재적용). */
export function clampRange(values: readonly (number | null)[], min: number, max: number): (number | null)[] {
  return values.map((v) => (v === null ? null : v < min || v > max ? null : v));
}

export interface AggregateResult {
  /** 최종 37개 값(정상이면 null 없음, 오류면 참고용으로 그대로 포함). */
  values: (number | null)[];
  /** 센서 오류 판정 결과. null이면 정상. */
  error: { missingMinutes: number } | null;
}

/**
 * 181개(1분) 원자료 → 37개(5분) 집계·결측 처리 전체 파이프라인.
 * docs/03 1.2의 4단계를 다음 순서로 적용한다: 1)집계 → 4)범위 검사(밖은 null, 결측과
 * 동등하게 취급) → 3)오류 판정(보간 전 결측 패턴 기준) → 2)짧은 결측 보간(최종 사용 값).
 *
 * 오류 판정(3단계, 연속 길이·비율)을 보간(2단계) *이전* 상태로 계산하는 이유: 보간은
 * maxGap 이하인 결측을 모두 메우므로, 보간 *후* 상태로 비율을 따지면 "짧지만 여러 군데
 * 흩어진 결측"이 전부 채워져 버려 20% 초과 규칙이 사실상 발동할 수 없다. docs 3단계
 * "37행 중 8행 초과면 오류"가 의미를 가지려면 보간 여부와 무관하게 원래 결측 개수를
 * 세야 한다. "범위 검사 후 2·3단계 재적용"은 이 순서(검사→판정→보간)로 구현해 범위 밖
 * 값이 만든 결측도 똑같이 판정·보간 대상에 포함시킨다.
 */
export function aggregateAndValidate(
  oneMinRaw: readonly (number | null)[],
  thresholds: AggregateThresholds,
): AggregateResult {
  let agg = aggregateToFiveMinute(oneMinRaw); // 1단계
  agg = clampRange(agg, thresholds.rangeMin, thresholds.rangeMax); // 4단계

  const gapInfo = analyzeGaps(agg); // 3단계 판정 기준(보간 전)
  const hasError = isSensorError(gapInfo, thresholds);

  const filled = interpolateShortGaps(agg, thresholds.interpMaxGap); // 2단계(최종 사용 값)

  // "N분 결측" 표시(docs/03 1.2 3단계) — 판정에 쓴 5분 단위 결측 슬롯 수를 분 단위로
  // 환산한다(05-open-questions.md #30, 개발자 결정: 분 환산 방식 미확정이라 가장 단순한
  // 쪽으로 처리).
  const missingMinutes = gapInfo.missingCount * ONE_MIN_PER_FIVE_MIN;

  return {
    values: filled,
    error: hasError ? { missingMinutes } : null,
  };
}
