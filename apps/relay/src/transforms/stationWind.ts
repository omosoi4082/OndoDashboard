/**
 * 기상대 센서(WS1) 풍속 단위 변환 — `CURWIND`·`MAXWIND`는 **km/h**로 들어온다.
 *
 * 경위(05-open-questions.md #43):
 * - 2026-10-14 기상대 `CURWIND` 8 vs 같은 시각 기상청 `WSD` 3.3 m/s로 2~3배 차이가 나서
 *   "km/h 아니냐"고 온도 측에 물었다(docs/replies/20261014-추가확인요청.md).
 * - 2026-10-15 온도 측 답변은 "확인해 보니 m/s가 맞습니다"였고, 그래서 환산 없이 그대로 썼다.
 * - 2026-10-17 실측에서 그 답을 뒤집을 증거가 나왔다. 맑고(RAIN 0, SOLAR 897, 날씨 CLEAR)
 *   같은 시각 기상청이 3.7 m/s인데 센서는 `CURWIND` 14.0, **`MAXWIND` 32.0**이었다.
 *   32 m/s는 보퍼트 12(태풍급) 순간풍속이라 맑은 날 값으로 물리적으로 성립하지 않는다.
 *   km/h로 읽으면 14 km/h = 3.9 m/s(기상청 3.7과 일치), 32 km/h = 8.9 m/s(자연스러운 돌풍)다.
 * - **사용자 결정(2026-10-17): km/h → m/s 환산을 적용한다.** 온도 측의 "m/s" 답변과 어긋나므로
 *   다음 회신에 이 근거와 함께 알리고 재확인받는다.
 *
 * 화면 표기 단위는 m/s 그대로다(기상청 `WSD`와 같은 단위로 맞춰야 두 패널을 나란히 읽을 수 있다).
 */

/** km/h → m/s. 1 m/s = 3.6 km/h. */
export const KMH_TO_MS = 3.6;

/**
 * 기상대 풍속(km/h)을 m/s로 바꾼다. null은 그대로 null(결측 유지 — 0으로 채우지 않는다).
 * 소수 첫째 자리까지 반올림한다 — 기상청 `WSD`가 0.1 m/s 단위로 와서 표기를 맞춘다.
 */
export function stationWindKmhToMs(kmh: number | null): number | null {
  if (kmh === null || !Number.isFinite(kmh)) return null;
  return Math.round((kmh / KMH_TO_MS) * 10) / 10;
}
