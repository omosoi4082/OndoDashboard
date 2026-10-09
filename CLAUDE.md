# CLAUDE.md

(주)온도 스마트 축사(돈사) 시뮬레이션 대시보드. 로컬 PC에서 구동하는 웹 대시보드와 중계 서버를 한 저장소에서 개발한다.

이 저장소는 원래 "스타터킷"(템플릿) 용도로 만들었다가, 회의를 거쳐 구체화된 스펙으로 교체해 실제 프로젝트 저장소로 쓴다.
3D 모델링·카메라/마우스 인터랙션 코드만 원래 있던 `technical-review/pig-farm-cfd-demo` 목업에서 포팅해 재사용한다
(`docs/07-starter-kit-assets.md` 참고).

## 먼저 읽을 문서

작업 전에 해당 단계와 관련된 문서를 읽는다. 문서와 코드가 다르면 문서가 기준이며, 문서끼리 충돌하면 작업을 멈추고 질문한다.

| 문서 | 내용 |
|---|---|
| `docs/01-functional-spec.md` | 화면 구성, 화면설계 번호별 기능, 모드별 동작, 기본값, 제한 사항 |
| `docs/02-relay-api.md` | 대시보드 ↔ 중계 서버 API 계약과 TypeScript 타입 |
| `docs/03-upstream-apis.md` | 중계 서버가 호출하는 센서 서버·기상청·연산 서버 API 규격과 변환 규칙 |
| `docs/04-tasks.md` | 단계별 작업 목록과 완료 조건 |
| `docs/05-open-questions.md` | 미확정 사항. 여기 있는 항목은 임의로 확정하지 말고 설정값이나 TODO로 남긴다 |
| `docs/07-starter-kit-assets.md` | `technical-review/pig-farm-cfd-demo` 중 포팅해 재사용할 3D/카메라 코드 목록 |
| `docs/06-design-guide.md` | UI 디자인 사양(색상 토큰, 영역별 스타일). 디자인은 시각 참고용, 기능은 기능 명세 기준 |
| `docs/design/` | 디자인 자료 모음: `screen-design.png`(화면설계서 on-01~05, 번호는 기능 명세의 설계 번호와 같다), `UI/`(모드별 UI 디자인), `icon/`(날씨 아이콘 원본) |

UI 디자인 자료는 `docs/design/`에만 모은다(2026-10-09).

## 구조

```
apps/dashboard              Vite + React + TypeScript + React Three Fiber
apps/relay                  Node.js + TypeScript 중계 서버 (Fastify)
packages/shared              대시보드와 중계 서버가 함께 쓰는 API 타입, 상수
mock/                        연산 서버·전문가·제어 모드 목업 데이터
docs/                        명세 문서
technical-review/            목업 단계 레퍼런스 코드 (3D/카메라 포팅 소스, docs/07 참고)
```

## 명령어

```
npm install
npm run dev        # relay(8080) + dashboard(5173, /api는 relay로 프록시) 동시 실행
npm run build       # shared → relay → dashboard 순서로 빌드
npm start           # relay가 dashboard 빌드 결과를 정적 서빙 (운영 모드, 단일 포트 8080)
npm test            # vitest
npm run lint
npm run typecheck
npm run mock:generate   # mock/ 목업 데이터 생성
npm run grid -- <lat> <lon>   # 위경도 → 기상청 격자(nx, ny)
```

## 반드시 지킬 규칙

- 대시보드는 `/api/*`(중계 서버)만 호출한다. 센서 서버, 기상청, 연산 서버를 브라우저에서 직접 호출하지 않는다.
- 센서 서버는 GET만 호출한다. 센서 서버의 제어용 POST API는 절대 호출하지 않는다.
- API 응답 타입은 `packages/shared`에만 정의하고 양쪽에서 import한다. 타입을 앱 안에 복제하지 않는다.
- 주소, 키, 격자 좌표, 타임아웃은 `.env`에서 읽는다. 코드에 하드코딩하지 않는다. 새 설정을 추가하면 `.env.example`도 같이 수정한다.
- 기상청 서비스키는 `.env`에만 두고 커밋하지 않는다.
- 연산 서버는 아직 연동 전이다. `COMPUTE_MODE=mock`일 때 목업 생성기를 쓰고, 실제 연동 코드는 어댑터 인터페이스 뒤에 둔다.
- 데이터베이스, 로그인, 사용자 설정 저장은 만들지 않는다(범위 밖).
- 지원 환경은 PC Chrome/Edge 최신 버전, 1920×1080 기준이다. 모바일 대응은 하지 않는다.
- 상위 서버 실패는 전체 실패로 만들지 않는다. 받은 값은 표시하고, 실패한 항목만 `sourceStatus: "disconnected"`로 응답해 화면에 끊김을 표시한다.
- 센서 응답의 항목 순서는 고정되어 있지 않다. 항상 항목명(키)으로 찾는다.
- 상세 패널(현재·예측·전문가·제어)은 실험군(EX) 자돈방 데이터만 다룬다. 육성·비육(회색)은 메인 호버 정보만 있고 클릭할 수 없다.
- 환기량은 FAN1 가동률(%) 하나만 쓴다. FAN2·FAN3는 다루지 않는다.
- 메인 화면 API는 영역별(rooms, weather/kma, weather/station)로 분리돼 있다. 하나로 합치지 않는다.
- 회의 결정이 우선이다. 온도 대시보드 연동명세서 v1.0은 회의 이전 참고 자료다.
- 연산 서버 요청은 `POST /v1/current`·`/v1/forecast`, 본문 `request_id` + `inputs[]{time, T_out, RH_out, fan_pct}`. 센서 원자료는 반올림·보간하지 않는다(빈 분은 null).
- 연산 서버 응답 구조는 우리 쪽 정의(docs/03 4.2)이며 시각별 값만 담는다. 포인트 좌표와 grid·flowGrid 정의는 고정 형상이라 `GET /api/detail/geometry`로 한 번만 받는다.
- 3D 메쉬·2D 단면은 125개 포인트가 아니라 grid 값(2,584개)으로 그리고, 유동 실린더는 flowGrid 값(288개)으로 그린다. 개수는 하드코딩하지 않고 geometry에서 읽는다.
- 현재 모드 입력 구간은 완료된 최근 10분 단위 정각을 끝으로 180분(1분 원자료 181개 → 5분 집계 37건)이다(docs/02 6장).

## 코드 규칙

- TypeScript strict. `any` 금지(불가피하면 이유를 주석으로).
- 변환 로직(날씨 판정, 풍향 16방위, 기상청 발표 시각 계산, 센서 응답 파싱)은 순수 함수로 분리하고 단위 테스트를 작성한다.
- 3D 포인트 125개는 InstancedMesh로 그린다. 포인트마다 개별 mesh를 만들지 않는다.
- 상태 관리는 zustand. 서버 데이터 폴링은 커스텀 훅 하나(`usePolling`)로 통일한다.
- UI 문구는 한국어. 코드 식별자와 커밋 메시지는 영어.
- 한 작업 단위가 끝나면 `npm run typecheck && npm test`가 통과해야 한다.

## 작업 방식

- `docs/04-tasks.md`의 단계 순서대로 진행한다. 단계를 건너뛰거나 여러 단계를 한 번에 크게 바꾸지 않는다.
- 각 단계의 완료 조건을 확인한 뒤 결과를 요약하고, 다음 단계로 넘어가기 전에 확인을 받는다.
- 명세에 없는 동작을 정해야 할 때는 가장 단순한 쪽으로 구현하고 `docs/05-open-questions.md`에 항목을 추가한다.
- 3D 모델링·카메라/마우스 인터랙션은 `technical-review/pig-farm-cfd-demo`에서 포팅해 재사용한다(`docs/07-starter-kit-assets.md`). 새로 짜지 않는다.
