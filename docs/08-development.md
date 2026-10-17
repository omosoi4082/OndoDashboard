# 08. 개발 환경

운영·전달 관련 안내는 저장소 루트 `README.md`에 있다(온도 측 비개발자용). 이 문서는 개발자용이다.

## 구동

```
npm install
npm run dev        # relay(8080) + dashboard(5173, /api는 relay로 프록시) 동시 실행
npm run build      # shared → relay → dashboard 순서로 빌드
npm start          # relay가 dashboard 빌드 결과를 정적 서빙 (운영 모드, 단일 포트 8080)
npm test           # vitest
npm run lint
npm run typecheck
npm run doctor     # 상태 점검 — .env·중계·센서·기상청·형상·상세 API 7단계 (check.bat과 동일)
npm run setup      # .env 대화형 설정 (setup.bat과 동일)
npm run mock:generate   # mock/ 목업 데이터 생성
npm run grid -- <lat> <lon>   # 위경도 → 기상청 격자(nx, ny)
```

`npm start`의 정적 서빙 조건은 **`apps/dashboard/dist/index.html` 존재 여부**다.
전에는 `NODE_ENV === 'production'`이었는데 `npm start`가 그 값을 세우지 않아 API만 뜨고 화면이
안 나오는 함정이 있었다(2026-10-17 수정, docs/04-tasks.md M7-1).

## 서브에이전트

`.claude/agents/`의 4개를 상황에 맞게 부른다("relay-builder 에이전트로 센서 연동 작업해줘").

- **spec-writer** — `docs/01~05` 기획/API/작업 문서를 쓰거나 고칠 때
- **relay-builder** — `apps/relay`(중계 서버) + `packages/shared` 타입 구현
- **dashboard-builder** — `apps/dashboard`(React Three Fiber 대시보드) 구현
- **qa-reviewer** — 단계 전환 전·납품 전 최종 점검

## 진행 순서

`docs/04-tasks.md`의 M0~M8 순서를 그대로 따른다. 단계를 건너뛰거나 여러 단계를 한 번에 바꾸지 않는다.

1. **M0** — npm workspaces 스캐폴딩
2. **M1/M2** — relay 메인 API · 대시보드 메인 화면(병렬 가능)
3. **M3~M6** — 상세 패널 공통 → 현재/예측/전문가/제어 모드
4. **M7** — 오류 처리·성능·Windows 이관 패키징 (2026-10-23 온도 측 무인 테스트 대응으로 재구성)
5. **M8** — 연산 서버 실제 연동

매 단계 완료 시 `qa-reviewer`로 `docs/04-tasks.md` 완료 조건과 `CLAUDE.md` 규칙 대비 점검한다.

## 전달 패키지 만들기

2026-10-17 사용자 결정에 따라 두 가지를 준비한다(docs/04-tasks.md M7-4).

**① 빌드 포함본**(기본) — 온도 측은 Node 설치 후 `start.bat`만 누르면 된다.

```
npm install && npm run build
```

그 뒤 아래를 **포함**해 압축한다. `.env`는 **반드시 넣는다**(기상청 키 전달 방식 — git에는 계속
커밋하지 않는다).

```
포함:  apps/ packages/ config/ mock/ docs/ node_modules/
       .env .env.example package.json package-lock.json
       *.bat README.md 테스트-체크리스트.md CLAUDE.md
제외:  technical-review/  .git/  *.log  점검결과.txt  .env.bak
```

**② 소스본** — 위에서 `node_modules/`와 빌드 결과를 빼고 압축한다. 온도 측이 `install.bat`을
먼저 실행한다.

전달 전 확인: 다른 폴더에 압축을 풀고 `start.bat` → `check.bat`이 모두 통과하는지 본다.
