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
# ① 빌드 포함본 — Node만 설치하면 start.bat만 누르면 된다
powershell -ExecutionPolicy Bypass -File scripts\make-package.ps1 -OutDir <경로> -Zip

# ② 소스본 — 받는 쪽이 install.bat으로 설치·빌드한다
powershell -ExecutionPolicy Bypass -File scripts\make-package.ps1 -OutDir <경로> -Source -Zip
```

| | ① 빌드 포함본 | ② 소스본 |
|---|---|---|
| 폴더 / 압축 | **69.6 MB / 19.6 MB** | **27.6 MB / 8.5 MB** |
| 받는 쪽 순서 | `start.bat` → `check.bat` → `test-ui.bat` | `install.bat` → `start.bat` → `check.bat` → `test-ui.bat` |
| 포함 | 빌드 결과 + 운영 의존성 + 화면 점검 도구 | 소스 + 설정(빌드 결과·node_modules 없음) |
| `install.bat` | **없음**(소스가 없어 빌드가 실패한다) | 있음 |
| 인터넷 | 기상청 조회에만 필요 | **설치에도 필요**(npm) |

①은 빌드 → staging → `npm install --omit=dev`, ②는 소스만 복사한다(빌드·설치 안 함).
둘 다 2026-10-17에 실제로 만들어 `check.bat` 7개 항목 통과까지 확인했고, 2026-10-18에
①에서 `test-ui.bat`(화면 자동 점검)까지 돌려 55항목 통과를 확인했다(1분 51초).
①이 51.7 → 69.6 MB로 커진 것은 화면 점검 도구(`@playwright/test`, 약 18 MB) 때문이다.

**전달본의 코드 주석은 스크립트가 뺀다**(2026-10-21). ①은 저장소 `dist`를 복사하지 않고
relay·shared를 **staging에 다시 컴파일한다**(`--removeComments --declaration false
--sourceMap false` + `*.test.js` 삭제). 저장소 `dist`에는 주석이 그대로 있어 복사하면
내부 경위(`docs/` 경로, 미확정 항목 번호 등)가 전달본에 섞여 나간다. 10/19에는 이 정리를
손으로 했는데 빠뜨리기 쉬워 스크립트에 넣었다. 저장소 `dist`는 건드리지 않는다 —
개발 중에는 주석·소스맵이 있어야 디버깅이 된다. 결과물은 손으로 정리한 10/21 패키지와
**바이트 단위로 같다**(relay 53개 / shared 2개 파일 해시 일치).

**연산 서버 주소는 `-ComputeUrl`로 넣는다**(2026-10-21). 패키지의 `.env`만
`COMPUTE_MODE=http` + 그 주소로 바꾸고, **저장소 `.env`는 `mock` 그대로 둔다.**

```
powershell -ExecutionPolicy Bypass -File scripts\make-package.ps1 `
  -OutDir <경로> -Zip -ComputeUrl http://192.168.10.91:9000
```

끝의 `/`는 알아서 떼고, `http://`·`https://`로 시작하지 않으면 멈춘다. `.env`에
`COMPUTE_MODE`·`COMPUTE_BASE_URL` 줄이 없으면 조용히 넘어가지 않고 멈춘다.
주지 않으면 `mock` 모드라고 **경고만** 찍고 계속한다 — 화면만 볼 패키지는 그대로 쓰면 된다.

**화면 자동 점검(`test-ui.bat`)도 같이 나간다** — `tests/`·`playwright.config.ts`를 복사하고,
①에는 `@playwright/test`를 `--no-save`로 **미리 설치해 둔다**(약 19 MB). 받는 쪽이 설치를
더 하지 않아도, 인터넷이 없어도 점검이 돈다. 브라우저는 내려받지 않는다 — 설치된
Chrome/Edge를 그대로 쓴다(`playwright.config.ts`의 `pickChannel()`). 둘 다 없으면
`test-ui.bat`이 안내만 하고 멈추고, 그때는 체크리스트 B부를 손으로 진행하면 된다.

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

### 납품본 — `-Delivery`

테스트 패키지가 아니라 **"쓰는 법"만 담은 납품본**이다(2026-10-22 사용자 지시 — "테스트 체크
이런 거 없이 온도에서 어떻게 사용하면 되는지만 필요하다").

```
# 납품 빌드 포함본
powershell -ExecutionPolicy Bypass -File scripts\make-package.ps1 `
  -Delivery -KmaKeyExpiry <yyyy-MM-dd> -OutDir <경로> -Zip -ComputeUrl http://192.168.10.91:9000

# 납품 소스본 (-Source를 더한다)
```

| | 테스트 패키지 | 납품본 |
|---|---|---|
| 문서 | `README.md`(점검 순서) + `테스트-체크리스트.md` | `docs/delivery/README.md`(사용 안내) |
| bat | start / check / setup / **test-ui** | start / check / setup |
| 포함 | `tests/`, `playwright.config.ts`, `@playwright/test`(19 MB) | 없음 |
| 크기(①) | 69.1 MB / 19.7 MB | **51.2 MB** / 약 14 MB |

- 납품본 문서는 `docs/delivery/README.md`·`docs/delivery/CLAUDE-구동안내.md`를 패키지 루트에
  `README.md`·`CLAUDE-구동안내.md`로 넣는다. 루트의 테스트용 두 문서는 그대로 둔다.
- **`-KmaKeyExpiry`는 필수다.** 기상청 서비스키가 개발 측 명의 발급분이라, 활용 마감일과
  재발급 절차(공공데이터포털 → 일반 인증키 **Decoding** → `setup.bat`)를 사용 안내에 박아
  넣는다. 문서의 `{{KMA_EXPIRY}}` 자리를 치환하고, 치환이 하나도 안 되거나 자리표시자가
  남으면 **멈춘다**(마감일이 빈 문서를 보내는 사고를 막는다).
- 빌드 포함본에는 `install.bat`이 없으므로, `start.bat`·`check.bat`의 "install.bat 을 먼저
  실행하세요" 안내를 "압축을 다시 풀어 주세요"로 바꿔 넣는다(bat은 cp949로 읽고 쓴다).

**`install.bat`은 빌드 포함본에 넣지 않는다** — 소스가 없어 `npm run build`가 실패한다.
소스본(②)을 만들 때만 넣는다.

### 소스본(②) 메모

`-Source`를 주면 `dist/`·`node_modules/`를 빼고 소스·설정만 복사한다. 빼는 것:
`docs/`(설계 자료 ~20 MB, 구동에 불필요) · `technical-review/` · `.git/` · `CLAUDE.md`
(개발용 지시서 — 구동용은 `CLAUDE-구동안내.md`).
구버전 glb 3개는 `public/assets/models`에서 미리 빼 둔다(소스본에서도 빌드 결과가 가벼워진다).

### 전달 전 확인 (2026-10-17 실행함)

1. 다른 폴더에 패키지를 만든다
2. 소스본이면 먼저 `install.bat`(또는 `npm install && npm run build`)
3. `start.bat`(또는 `npm start`) → 로그에 접속 주소가 뜨는지
4. `check.bat`(또는 `npm run doctor`) → 7개 항목이 모두 ✅ 인지
5. `test-ui.bat`(또는 `npm run test:ui`) → `화면점검결과.txt`에 실패 0인지
6. 브라우저로 접속해 화면이 뜨는지

> 패키지 폴더에서 서버를 띄워 둔 채로 패키지를 다시 만들면 `Remove-Item`이 실패한다
> (node가 폴더를 잡고 있다). 다시 만들기 전에 서버 창을 닫는다.

> ★ `doctor`·`setup`은 **빌드 결과(`dist/scripts/*.js`)를 실행**한다. 전에는 `tsx src/...`였는데
> 전달 패키지에는 `tsx`(개발 의존성)도 `src/`도 없어서 **`check.bat`이 통째로 실패했다**
> (2026-10-17 이 점검에서 발견). 스크립트를 소스에서 돌리게 되돌리지 말 것.
