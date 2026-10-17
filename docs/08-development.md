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

```
powershell -ExecutionPolicy Bypass -File scripts\make-package.ps1 -OutDir <경로> [-Zip]
```

빌드 → 필요한 파일만 staging → staging에서 `npm install --omit=dev` 순서로 돈다.
2026-10-17 실측 결과 **폴더 51.7 MB / 압축 15.6 MB**.

**패키지를 작게 만든 두 가지**

- `apps/dashboard`를 **워크스페이스에서 뺀다.** 대시보드는 정적 파일(dist)로만 나가고
  three·react·lucide-react 같은 의존성은 이미 번들에 들어 있다. `package.json`을 같이 넣으면
  npm이 그 의존성까지 설치해 **약 220 MB**가 더 붙는다(248 MB → 51.7 MB 차이의 대부분).
  중계 서버는 `apps/dashboard/dist` **폴더만** 보므로 `package.json`이 필요 없다.
- `public/assets/models`의 **구버전 glb 3개를 뺀다**(약 40 MB). 실제로 쓰는 것은
  `OVERVIEW_MODEL_URL`·`DETAIL_MODEL_URL`이 가리키는 둘뿐이다.

**경로가 깨지지 않는 이유**: 중계 서버는 `.env`·`config/geometry.json`·`mock/*.json`을
cwd가 아니라 **실행 파일 위치 기준**(`apps/relay/dist/config`에서 `../../../../`)으로 찾는다.
그래서 `apps/relay/dist` 깊이만 유지되면 어디에 풀어도 동작한다.

**`.env`는 반드시 포함한다**(2026-10-17 결정 — 기상청 키를 전달 패키지로 넘긴다).
git에는 계속 커밋하지 않는다.

**`install.bat`은 빌드 포함본에 넣지 않는다** — 소스가 없어 `npm run build`가 실패한다.
소스본(②)을 만들 때만 넣는다.

### 소스본(②) 만들기

`node_modules/`와 각 `dist/`를 뺀 저장소를 압축하고 `install.bat`을 넣는다. 받는 쪽이
`install.bat`으로 설치·빌드한다.

### 전달 전 확인 (2026-10-17 실행함)

1. 다른 폴더에 패키지를 만든다
2. 그 폴더에서 `start.bat`(또는 `npm start`) → 로그에 접속 주소가 뜨는지
3. `check.bat`(또는 `npm run doctor`) → 7개 항목이 모두 ✅ 인지
4. 브라우저로 접속해 화면이 뜨는지

> ★ `doctor`·`setup`은 **빌드 결과(`dist/scripts/*.js`)를 실행**한다. 전에는 `tsx src/...`였는데
> 전달 패키지에는 `tsx`(개발 의존성)도 `src/`도 없어서 **`check.bat`이 통째로 실패했다**
> (2026-10-17 이 점검에서 발견). 스크립트를 소스에서 돌리게 되돌리지 말 것.
