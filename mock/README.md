# mock/

전문가·제어 모드 목업 데이터(`docs/03-upstream-apis.md` 4.4). relay가 이 폴더의 JSON 파일을 그대로 읽어서 응답한다 — 파일만 교체하면 코드 수정 없이 내용이 바뀐다.

## 현재 파일: 온도 측 제공 v3 (2026-10-13, (주)온도 예측 모델 담당)

※ v2(2026-10-08) 묶음은 이것으로 교체됨. 모든 응답 파일에 `"mock_version": "v3 (2026-10-13)"`가 들어 있다.

**v3에서 바뀐 것**
- 모든 응답 파일에 **`range`(색 범위)·`geometryId`** 추가. `range`는 `{temp:[min,max], rh:[min,max], flow:[0,max]}` **배열** 형식이라 relay가 우리 `MinMax`(`{min,max}`)로 바꿔 담는다(`clients/computeClient.ts`의 `toComputeRange`).
- 현재·예측 모드 요청 예시를 최신 규칙으로 갱신(기상청 초단기실황 5분 보간, 팬 5분 평균, null 없음).
- `geometry.json`은 v2와 **완전히 동일**해서 교체할 필요가 없었다.

| 파일 | 용도 |
|---|---|
| `geometry.json` | 중계 서버 `GEOMETRY_FILE`용 원본(`config/geometry.json`에 복사해서 씀). 125개 포인트 좌표(id 0~124), 방 구조(칸막이·급기구·배기구·센서), grid·flowGrid 정의 |
| `sample_request_current.json` | `POST /v1/current` 요청 예시. 5분 평균 실측값 37건(12:20~15:20). 결측은 중계 서버가 보간·판정하므로 null 없음 |
| `sample_request_forecast.json` | `POST /v1/forecast` 요청 예시. 실측 37건 + 예보 288건 = 325건. `forecast_from`/`forecast_issued_at` 포함. 예보 구간의 `fan_pct`는 외기 기온 **5단 구간 규칙**(<22℃ 20%, 22~24 40%, 24~26 60%, 26~28 80%, ≥28 100%, 경계는 아래쪽 포함)으로 중계 서버가 채운 값 — v2까지 쓰던 직선 보간식은 2026-10-13 B-4로 폐기됐다 |
| `sample_response_current.json` | 현재 모드 **연산 서버 원응답** 예시(1프레임) — 중계 서버 변환(시각 +09:00·offsetMin 부착) 전 단계임에 주의 |
| `sample_response_forecast.json` | 예측 모드 **연산 서버 원응답** 예시(10분 간격 145프레임) — 위와 동일하게 변환 전 |
| `mock_expert.json` | 전문가 모드 목업. 극한 환경(외기 32.5~37.5℃, 환기 100%) 24시간 입력(`input`)과 결과 145프레임 |
| `mock_control.json` | 제어 모드 목업(에너지 최적화 개념, `target:"energy"`). 24시간 입력(`input`), `control` 블록, 결과 145프레임 |

### 읽는 법 — 대시보드 화면 기준

- 응답 파일은 모두 중계 서버 명세 6.2 구조이며, 추가 필드(`model_version`, `frames[].outdoor`, `frames[].summary`, `frames[].quality`)가 더 있다.
- **`mock_expert.json`/`mock_control.json`은 "연산 서버 원응답 + 목업 전용 필드"다** — `baseAt`·`mode`·`frames[].offsetMin`이 없다. relay가 `buildCurrentDetail`/`buildForecastDetail`과 같은 변환(시각 처리·offsetMin 부여)을 거쳐 최종 응답을 만들어야 한다 — 파일을 그대로 돌려주면 안 된다.
- **`range`는 파일 값을 그대로 쓴다**(v3부터 모든 응답 파일에 들어 있다). relay가 프레임을 훑어 계산하지 않는다 — 특히 `range.flow`의 max는 급기구 바로 아래 극값을 뺀 **95퍼센타일**이라, 실제 최댓값으로 계산하면 극값 하나 때문에 나머지 288점이 색 범위 하단에 몰려 화면이 거의 단색이 된다. max보다 큰 값은 max 색으로 표시하면 된다.
- **`geometryId`는 `pig-nh-v1`과 일치해야 한다**. 배열 순서가 그 형상 파일을 따르므로, 다르면 relay가 오류로 처리한다(`transforms/detailTransform.ts`).
- 목업 두 파일의 최상위 `input` 필드는 **대시보드가 보낼 `{temp,rh,vent}`가 아니라, 이 목업을 만들 때 쓴 연산 서버 요청 원본**(`request_id`/`forecast_from`/`inputs[]` 등)이다. `GET /api/detail/expert`의 응답 `input`은 relay가 **요청 쿼리 파라미터(`temp`,`rh`,`vent`)로 새로 조립**해야 한다(목업 파일의 `input`을 그대로 쓰면 안 됨 — 05-open-questions.md #24).
- 목업 두 파일에는 `scenario`, `guide`(필드 설명), `mock`, `mock_version`, `note`, `request_id`, `status`가 더 있다 — 최종 응답에는 포함하지 않는다(우리 쪽 `ExpertDetail`/`ControlDetail` 타입에 없는 필드).
- `mock_control.json`의 `control` 블록은 `snake_case`(`baseline_fan_pct` 등 + `fan_rated_kw`·`power_model`)다 — `packages/shared`의 `ControlBlock`(`baselineFanPct` 등 camelCase, `fan_rated_kw`/`power_model` 없음)으로 매핑해야 한다.
- `mock_control.json`은 `target:"energy"` 시나리오 하나만 있다(`environment`는 아직 없음, 05-open-questions.md #27: 목업 단계는 하나만 있어도 충분). `target=environment` 요청도 지금은 같은 파일로 응답하되, 응답의 `target` 필드는 요청받은 값으로 채운다.
- `mock_control.json`: `frames`와 `frames[].outdoor.fan_pct`는 "최적화 후" 값이다. "최적화 전" 환기량·실내 온도는 `control.baseline_fan_pct`/`baseline_T_mean`에 있다. `control`의 배열은 모두 145개로 `frames`와 같은 순서이며, 시간축은 `frames[i].time`을 그대로 쓰면 된다. 두 곡선을 겹쳐 그리고 `saving_pct`를 함께 표시하면 개념이 전달된다. 최적화 후 실내 평균 온도는 모두 상한(30℃) 이하다.
- `mock_expert.json`: 극한 조건이라 `quality.in_range`가 전 프레임 `false`다. "참고용" 표시가 전 구간에 나오는 것이 의도된 동작이다.
- 요청의 `inputs`에는 null이 없어야 한다. 결측 보간과 센서 오류 판정은 중계 서버가 하며, 연산 서버는 null이 있으면 `BAD_REQUEST`를 돌려준다.
- 배열 개수: points 125, grid 2,584, flow 288. 인덱스 규칙 `i + nx×(j + ny×k)`.
- 유동 `[vx, vy, vz, value]`는 m/s, 소수 셋째 자리. 온도 ℃·습도 %는 소수 둘째 자리.

## 생성 스크립트(참고용, 지금은 실제 파일이 있어 필요 없음)

`npm run mock:generate`(`apps/relay/src/scripts/mockGenerate.ts`)는 실제 파일을 못 받았을 때 같은 형식의 합성(결정적) 데이터를 만드는 폴백이다(`docs/03-upstream-apis.md` 4.3). 지금은 위 실제 파일을 쓰므로 실행할 필요 없다 — 온도 측 파일이 또 바뀌거나 빠졌을 때만 쓴다.
