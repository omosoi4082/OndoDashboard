# 온도 프로젝트 — 스마트 축사(돈사) 대시보드

> 이 저장소는 원래 "스타터킷"(템플릿) 용도로 만들었다가, 회의를 거쳐 구체화된 스펙(`docs/01~05`)으로
> 내용을 교체해 실제 프로젝트 저장소로 쓴다. 3D 모델링·카메라/마우스 인터랙션 코드는 이 저장소에
> 원래 있던 `technical-review/pig-farm-cfd-demo` 목업에서 포팅해 재사용한다(`docs/07-starter-kit-assets.md`).

## 사용법

1. VS Code에서 이 프로젝트를 열고 Claude Code를 실행하면, `CLAUDE.md`를 자동으로 읽어 컨텍스트로 사용합니다.
2. `.claude/agents/` 안의 4개 서브에이전트는 아래처럼 상황에 맞게 불러 씁니다
   (Claude Code에게 "relay-builder 에이전트로 센서 연동 작업해줘"처럼 자연어로 요청하면 됩니다):

   - **spec-writer** — `docs/01~05` 기획/API/작업 문서를 쓰거나 고칠 때
   - **relay-builder** — `apps/relay`(중계 서버) + `packages/shared` 타입 구현
   - **dashboard-builder** — `apps/dashboard`(React Three Fiber 대시보드) 구현
   - **qa-reviewer** — 기능 완성 후, 특히 단계 전환 전·납품 전 최종 점검할 때

   디자인 가이드(`docs/06-design-guide.md`)와 `ui-designer` 에이전트는 온도 측 디자인 자료를 받으면 추가한다
   (`docs/05-open-questions.md` #23).

## 권장 진행 순서

`docs/04-tasks.md`의 M0~M8 순서를 그대로 따른다. 단계를 건너뛰거나 여러 단계를 한 번에 바꾸지 않는다.

1. **M0** — npm workspaces 스캐폴딩(`apps/dashboard`, `apps/relay`, `packages/shared`, `mock/`)
2. **M1/M2** — relay 메인 API(`relay-builder`) · 대시보드 메인 화면(`dashboard-builder`, 병렬 가능)
3. **M3~M6** — 상세 패널 공통 → 현재/예측/전문가/제어 모드
4. **M7** — 오류 처리·성능·Windows 이관 패키징
5. **M8** — 연산 서버 실제 연동 (형식 확정 후)

매 단계 완료 시 `qa-reviewer`로 `docs/04-tasks.md` 완료 조건과 CLAUDE.md 규칙 대비 점검한다.

## 문서 구성

| 문서 | 내용 |
|---|---|
| `docs/01-functional-spec.md` | 화면 구성, 기능, 모드별 동작 |
| `docs/02-relay-api.md` | 대시보드 ↔ 중계 서버 API 계약 + TypeScript 타입 |
| `docs/03-upstream-apis.md` | 중계 서버 → 센서 서버·기상청·연산 서버 연동 규칙 |
| `docs/04-tasks.md` | 단계별 작업 목록과 완료 조건 |
| `docs/05-open-questions.md` | 미확정 사항 — 임의로 확정하지 않는다 |
| `docs/07-starter-kit-assets.md` | 포팅해 재사용할 3D/카메라 코드 목록 |

문서가 코드보다 먼저 갱신되게만 하면, 이 문서들로 기획~구현~납품 전 점검까지 커버한다.
