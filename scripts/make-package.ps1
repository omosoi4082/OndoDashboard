# 온도 측 전달 패키지 만들기 (docs/08-development.md "전달 패키지 만들기")
#
# 사용법:  powershell -ExecutionPolicy Bypass -File scripts\make-package.ps1 [-OutDir <경로>] [-Zip]
#
# 하는 일
#   1. 빌드(shared → relay → dashboard)
#   2. 실행에 필요한 것만 골라 staging 폴더에 복사
#   3. staging에서 `npm install --omit=dev`로 **운영 의존성만** 설치
#      (개발 의존성 vite·typescript·eslint·vitest 등 ~400 MB를 뺀다)
#   4. 쓰지 않는 구버전 3D 모델 제거
#
# 왜 경로 구조를 그대로 두는가: 중계 서버가 `.env`·`config/geometry.json`·`mock/*.json`을
# **실행 파일 위치 기준**(apps/relay/dist/config에서 ../../../../)으로 찾는다. cwd가 아니라
# 파일 위치라서, apps/relay/dist 깊이가 유지되면 어디에 풀든 동작한다.

param(
  [string]$OutDir = "",
  [switch]$Zip,
  [switch]$SkipBuild,
  # 소스본(②) — 빌드 결과와 node_modules 없이 소스만 담는다. 받는 쪽이 install.bat으로
  # 설치·빌드한다(docs/08-development.md). 빌드 포함본(①)이 기본이다.
  [switch]$Source
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

# 화면 자동 점검 도구 버전 — 저장소 devDependencies와 같은 것을 패키지에 넣는다.
$PlaywrightVersion = (Get-Content (Join-Path $repo 'package.json') -Raw -Encoding UTF8 |
  ConvertFrom-Json).devDependencies.'@playwright/test' -replace '^[\^~]', ''

if ($OutDir -eq "") {
  $stamp = Get-Date -Format 'yyyyMMdd'
  $suffix = if ($Source) { "-src" } else { "" }
  $OutDir = Join-Path (Split-Path -Parent $repo) "ondo-dashboard-$stamp$suffix"
}
$kind = if ($Source) { "소스본(install.bat으로 설치·빌드)" } else { "빌드 포함본(start.bat만 누르면 됨)" }

Write-Host "저장소 : $repo"
Write-Host "패키지 : $OutDir"
Write-Host "종류   : $kind"
Write-Host ""

# ── 1. 빌드 ────────────────────────────────────────────────────────────────
if ($Source) {
  Write-Host "[1/4] 소스본이라 빌드하지 않습니다(받는 쪽이 install.bat으로 빌드)." -ForegroundColor DarkGray
} elseif (-not $SkipBuild) {
  Write-Host "[1/4] 빌드 중..." -ForegroundColor Cyan
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw "빌드 실패" }
} else {
  Write-Host "[1/4] 빌드 건너뜀(-SkipBuild)" -ForegroundColor DarkGray
}

# ── 2. 파일 고르기 ─────────────────────────────────────────────────────────
Write-Host "[2/4] 파일 복사 중..." -ForegroundColor Cyan
if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

if ($Source) {
  # ── 소스본(②) ──────────────────────────────────────────────────────────
  # 빌드에 필요한 소스·설정을 담는다. node_modules·dist·git·개발 참고 자료는 뺀다.
  # install.bat을 **넣는다**(빌드 포함본과 반대).
  $srcRoot = @(
    'package.json', 'package-lock.json', 'tsconfig.base.json', 'vitest.config.ts',
    'eslint.config.js', '.prettierrc.json',
    '.env', '.env.example',
    'start.bat', 'check.bat', 'setup.bat', 'install.bat', 'test-ui.bat',
    'playwright.config.ts',
    'README.md', '테스트-체크리스트.md', 'CLAUDE-구동안내.md'
  )
  foreach ($f in $srcRoot) {
    if (Test-Path $f) { Copy-Item $f -Destination $OutDir }
    else { Write-Host "    ! 없음: $f" -ForegroundColor Yellow }
  }
  foreach ($d in @('config', 'mock', 'tests')) { Copy-Item $d -Destination (Join-Path $OutDir $d) -Recurse }

  # 워크스페이스 소스 — dist와 node_modules는 제외하고 통째로 복사
  foreach ($ws in @('apps\relay', 'apps\dashboard', 'packages\shared')) {
    $dst = Join-Path $OutDir $ws
    New-Item -ItemType Directory -Path $dst -Force | Out-Null
    Get-ChildItem $ws -Force | Where-Object { $_.Name -notin @('dist', 'node_modules') } | ForEach-Object {
      Copy-Item $_.FullName -Destination $dst -Recurse -Force
    }
  }

  # 쓰지 않는 구버전 모델은 소스본에서도 뺀다(public에 있어 빌드 때 dist로 따라간다).
  $keepModels = @('weaner_barn.glb', 'weaner_room_single.glb')
  $pubModels = Join-Path $OutDir 'apps\dashboard\public\assets\models'
  if (Test-Path $pubModels) {
    Get-ChildItem $pubModels -File | Where-Object { $keepModels -notcontains $_.Name } | ForEach-Object {
      Write-Host ("    - 구버전 모델 제외: {0} ({1:N1} MB)" -f $_.Name, ($_.Length / 1MB))
      Remove-Item $_.FullName -Force
    }
  }
}
else {

  if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

  # 루트 파일 — .env를 **반드시 포함**한다(2026-10-17 결정: 기상청 키를 전달 패키지로 넘긴다).
  # install.bat은 넣지 않는다: 이 패키지에는 소스가 없어 `npm run build`가 실패한다.
  # (소스본을 따로 만들 때만 넣는다 — docs/08-development.md)
  $rootFiles = @(
    'package.json', 'package-lock.json',
    '.env', '.env.example',
    'start.bat', 'check.bat', 'setup.bat', 'test-ui.bat',
    'playwright.config.ts',
    'README.md', '테스트-체크리스트.md', 'CLAUDE-구동안내.md'
  )
  foreach ($f in $rootFiles) {
    if (Test-Path $f) { Copy-Item $f -Destination $OutDir }
    else { Write-Host "    ! 없음: $f" -ForegroundColor Yellow }
  }

  # 런타임에 읽는 데이터 + 화면 자동 점검 스크립트(tests/ui — test-ui.bat이 쓴다)
  foreach ($d in @('config', 'mock', 'tests')) {
    Copy-Item $d -Destination (Join-Path $OutDir $d) -Recurse
  }

  # 워크스페이스 — package.json과 **주석·소스맵·.d.ts 없는 빌드 결과**(소스는 넣지 않는다).
  # ★ apps\dashboard는 **워크스페이스에서 뺀다**. 대시보드는 정적 파일(dist)로만 나가고
  #   three·react·lucide-react 같은 의존성은 이미 번들(dist/assets/index-*.js)에 들어 있다.
  #   package.json을 넣으면 npm이 그 의존성(약 220 MB)까지 설치해 패키지가 쓸데없이 커진다.
  #   중계 서버는 apps/dashboard/dist **폴더만** 보므로 package.json이 필요 없다.
  #
  # ★ dist를 복사하지 않고 **staging에 새로 컴파일한다**(2026-10-21 결정). 저장소 dist에는
  #   코드 주석이 그대로 남아 있어 복사하면 내부 경위(docs 경로, 미확정 항목 번호 등)가 전달본에
  #   섞여 나간다. 10/19에는 이 정리를 손으로 했는데, 빠뜨리면 그대로 나가므로 스크립트에 넣었다.
  #   저장소 dist는 건드리지 않는다 — 개발 중에는 주석·소스맵이 있어야 디버깅이 된다.
  #   함께 빠지는 것: .d.ts·소스맵(실행에 불필요), 테스트 컴파일 결과(*.test.js).
  #   순서가 중요하다 — relay를 컴파일할 때 @ondo/shared의 .d.ts로 타입을 해석하므로
  #   shared를 먼저 **저장소에** 평소대로 빌드해 둔다.
  if (-not (Test-Path 'packages\shared\dist\index.d.ts')) {
    & npx tsc -p packages\shared\tsconfig.json
    if ($LASTEXITCODE -ne 0) { throw "packages/shared 타입 선언 빌드 실패" }
  }

  foreach ($ws in @('packages\shared', 'apps\relay')) {
    $dst = Join-Path $OutDir $ws
    New-Item -ItemType Directory -Path $dst -Force | Out-Null
    Copy-Item (Join-Path $ws 'package.json') -Destination $dst
    $outDist = Join-Path $dst 'dist'
    & npx tsc -p (Join-Path $ws 'tsconfig.json') `
      --removeComments --declaration false --declarationMap false --sourceMap false `
      --outDir $outDist
    if ($LASTEXITCODE -ne 0) { throw "전달본 컴파일 실패: $ws" }

    $testJs = @(Get-ChildItem $outDist -Recurse -File -Filter '*.test.js')
    if ($testJs.Count -gt 0) {
      $testJs | Remove-Item -Force
      Write-Host ("    - $ws 테스트 컴파일 결과 제외: {0}개" -f $testJs.Count)
    }
    $kept = @(Get-ChildItem $outDist -Recurse -File).Count
    Write-Host ("    - $ws 주석·소스맵 없이 컴파일: {0}개" -f $kept)
  }

  # 대시보드는 빌드 결과만 복사한다.
  $dashDist = 'apps\dashboard\dist'
  if (-not (Test-Path $dashDist)) { throw "빌드 결과가 없습니다: $dashDist" }
  New-Item -ItemType Directory -Path (Join-Path $OutDir 'apps\dashboard') -Force | Out-Null
  Copy-Item $dashDist -Destination (Join-Path $OutDir $dashDist) -Recurse

  # staging의 루트 package.json에서 대시보드를 워크스페이스에서 빼고 개발 의존성을 지운다.
  $pkgPath = Join-Path $OutDir 'package.json'
  $pkg = Get-Content $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $pkg.workspaces = @('apps/relay', 'packages/shared')
  if ($pkg.PSObject.Properties['devDependencies']) { $pkg.PSObject.Properties.Remove('devDependencies') }
  $pkg | ConvertTo-Json -Depth 20 | Set-Content $pkgPath -Encoding UTF8

  # 쓰지 않는 구버전 모델 제거 — public/ 전체가 dist로 복사되면서 따라 들어온다.
  # 실제로 쓰는 것은 scene/barnModel.ts의 OVERVIEW_MODEL_URL과
  # scene/detailRoomModel.ts의 DETAIL_MODEL_URL 둘뿐이다.
  $keepModels = @('weaner_barn.glb', 'weaner_room_single.glb')
  $modelDir = Join-Path $OutDir 'apps\dashboard\dist\assets\models'
  if (Test-Path $modelDir) {
    Get-ChildItem $modelDir -File | Where-Object { $keepModels -notcontains $_.Name } | ForEach-Object {
      Write-Host ("    - 구버전 모델 제외: {0} ({1:N1} MB)" -f $_.Name, ($_.Length / 1MB))
      Remove-Item $_.FullName -Force
    }
  }

  # ── 3. 운영 의존성만 설치 ──────────────────────────────────────────────────
}

if ($Source) {
  Write-Host "[3/4] 소스본이라 의존성을 설치하지 않습니다(받는 쪽이 install.bat으로 설치)." -ForegroundColor DarkGray
} else {
  Write-Host "[3/4] 운영 의존성 설치 중(개발 의존성 제외)..." -ForegroundColor Cyan
  Push-Location $OutDir
  try {
    & npm install --omit=dev --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install 실패" }

    # 화면 자동 점검 도구(test-ui.bat이 쓴다). --no-save라 package.json은 그대로 두고
    # node_modules에만 들어간다 — 받는 쪽이 설치를 더 하지 않아도, 인터넷이 없어도 점검이 돈다.
    # 브라우저는 따로 받지 않는다(설치된 Chrome/Edge를 쓴다 — playwright.config.ts 참고).
    Write-Host "      + 화면 자동 점검 도구 @playwright/test@$PlaywrightVersion" -ForegroundColor DarkGray
    # --omit=dev를 빼면 안 된다 — package-lock에 적힌 개발 의존성(typescript·vitest·esbuild 등
    #  약 90 MB)까지 다시 깔려 패키지가 세 배가 된다(2026-10-18 실측 51.7 → 155.7 MB).
    & npm install --omit=dev --no-save --ignore-scripts --no-audit --no-fund "@playwright/test@$PlaywrightVersion"
    if ($LASTEXITCODE -ne 0) { throw "@playwright/test 설치 실패" }
  } finally { Pop-Location }
}

# ── 4. 결과 ────────────────────────────────────────────────────────────────
Write-Host "[4/4] 정리" -ForegroundColor Cyan
$mb = [math]::Round((Get-ChildItem $OutDir -Recurse -File -EA SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB, 1)
Write-Host ""
Write-Host "완료: $OutDir  ($mb MB)" -ForegroundColor Green

if ($Zip) {
  $zipPath = "$OutDir.zip"
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Write-Host "압축 중..."
  Compress-Archive -Path "$OutDir\*" -DestinationPath $zipPath
  $zmb = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
  Write-Host "압축 완료: $zipPath  ($zmb MB)" -ForegroundColor Green
}

Write-Host ""
if ($Source) {
  Write-Host "다음: 그 폴더에서 install.bat → start.bat → check.bat → test-ui.bat 순서로 확인하세요."
} else {
  Write-Host "다음: 그 폴더에서 start.bat → check.bat → test-ui.bat 으로 확인하세요."
}
