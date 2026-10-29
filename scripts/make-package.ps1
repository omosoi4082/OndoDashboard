# 온도 측 전달 패키지 만들기 (docs/08-development.md "전달 패키지 만들기")
#
# 사용법:  powershell -ExecutionPolicy Bypass -File scripts\make-package.ps1 [-OutDir <경로>] [-Zip]
#          [-ComputeUrl http://192.168.10.91:9000]  ← 패키지 .env를 그 연산 서버로 맞춘다
#          [-Viz on|off]                             ← 패키지 .env의 가시화 데이터(COMPUTE_VIZ)
#          [-Delivery -KmaKeyExpiry 2027-10-31]     ← 납품본(점검 도구·체크리스트 제외)
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
  [switch]$Source,
  # 연산 서버 주소 — 주면 **패키지의 .env만** COMPUTE_MODE=http + 이 주소로 바꾼다.
  # 저장소 .env는 건드리지 않는다. 예: -ComputeUrl http://192.168.10.91:9000
  [string]$ComputeUrl = "",
  # 가시화 데이터(v1.3.3 viz) — on이면 패키지 .env의 COMPUTE_VIZ=true. 손으로 넣다 빠뜨리기
  # 쉬워 옵션으로 넣었다(2026-10-29 테스트 패키지는 압축 직전에 손으로 넣었다).
  [ValidateSet('on', 'off')]
  [string]$Viz = "",
  # 납품본 — 테스트용이 아니라 "쓰는 법"만 담는다(2026-10-22 사용자 지시).
  #   빼는 것 : 테스트-체크리스트.md, test-ui.bat, tests/, playwright.config.ts, @playwright/test
  #   바꾸는 것: README.md·CLAUDE-구동안내.md를 docs/delivery/ 의 사용 안내본으로
  #   남기는 것: start.bat(실행), check.bat(값이 안 나올 때 진단), setup.bat(설정)
  [switch]$Delivery,
  # 납품본에 적을 기상청 서비스키 활용 마감일(yyyy-MM-dd). 개발 측 명의 키를 넣어 보내므로
  # 그 날짜와 재발급 절차를 사용 안내에 박아 둔다 — -Delivery에서는 필수다.
  [string]$KmaKeyExpiry = ""
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

# package.json을 **BOM 없이** 쓴다. Windows PowerShell 5.1의 `Set-Content -Encoding UTF8`은
# BOM을 붙이는데, 루트 package.json에 BOM이 붙으면 vite가 PostCSS 설정을 찾느라 그 파일을
# JSON.parse할 때 깨져서 **소스본의 `npm run build`가 실패한다**(2026-10-22 실측:
# "Failed to load PostCSS config ... Unexpected token '﻿'").
function WriteJsonNoBom([string]$path, $obj) {
  $json = $obj | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding $false))
}

# 화면 자동 점검 도구 버전 — 저장소 devDependencies와 같은 것을 패키지에 넣는다.
$PlaywrightVersion = (Get-Content (Join-Path $repo 'package.json') -Raw -Encoding UTF8 |
  ConvertFrom-Json).devDependencies.'@playwright/test' -replace '^[\^~]', ''

if ($Delivery) {
  if ($KmaKeyExpiry -eq "") {
    throw "납품본에는 -KmaKeyExpiry <yyyy-MM-dd>가 필요합니다 (기상청 서비스키 활용 마감일 — 사용 안내에 적습니다)."
  }
  if ($KmaKeyExpiry -notmatch '^\d{4}-\d{2}-\d{2}$') {
    throw "-KmaKeyExpiry는 yyyy-MM-dd 형식이어야 합니다: $KmaKeyExpiry"
  }
} elseif ($KmaKeyExpiry -ne "") {
  throw "-KmaKeyExpiry는 -Delivery와 함께만 쓸 수 있습니다."
}

if ($OutDir -eq "") {
  $stamp = Get-Date -Format 'yyyyMMdd'
  $suffix = if ($Source) { "-src" } else { "" }
  $prefix = if ($Delivery) { "ondo-dashboard-납품-" } else { "ondo-dashboard-" }
  $OutDir = Join-Path (Split-Path -Parent $repo) "$prefix$stamp$suffix"
}
$kind = if ($Source) { "소스본(install.bat으로 설치·빌드)" } else { "빌드 포함본(start.bat만 누르면 됨)" }
if ($Delivery) { $kind = "납품본 / $kind" }

# 납품본의 사용 안내는 저장소 루트가 아니라 docs/delivery/ 에서 가져온다.
$docDir = if ($Delivery) { 'docs\delivery' } else { '.' }
# 테스트 전용으로 빠지는 것들
$testOnlyFiles = @('test-ui.bat', 'playwright.config.ts', '테스트-체크리스트.md')
$dataDirs = if ($Delivery) { @('config', 'mock') } else { @('config', 'mock', 'tests') }

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
    'start.bat', 'check.bat', 'setup.bat', 'install.bat'
  )
  if (-not $Delivery) { $srcRoot += $testOnlyFiles }
  foreach ($f in $srcRoot) {
    if (Test-Path $f) { Copy-Item $f -Destination $OutDir }
    else { Write-Host "    ! 없음: $f" -ForegroundColor Yellow }
  }
  foreach ($f in @('README.md', 'CLAUDE-구동안내.md')) {
    Copy-Item (Join-Path $docDir $f) -Destination $OutDir
  }
  foreach ($d in $dataDirs) { Copy-Item $d -Destination (Join-Path $OutDir $d) -Recurse }

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
    'start.bat', 'check.bat', 'setup.bat'
  )
  if (-not $Delivery) { $rootFiles += $testOnlyFiles }
  foreach ($f in $rootFiles) {
    if (Test-Path $f) { Copy-Item $f -Destination $OutDir }
    else { Write-Host "    ! 없음: $f" -ForegroundColor Yellow }
  }
  foreach ($f in @('README.md', 'CLAUDE-구동안내.md')) {
    Copy-Item (Join-Path $docDir $f) -Destination $OutDir
  }

  # 런타임에 읽는 데이터 (+ 테스트본은 화면 자동 점검 스크립트 tests/ui — test-ui.bat이 쓴다)
  foreach ($d in $dataDirs) {
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
  WriteJsonNoBom $pkgPath $pkg

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

# ── 2-b. 패키지 .env의 연산 서버 주소 ─────────────────────────────────────
# -ComputeUrl을 주면 **패키지의 .env만** http 모드 + 그 주소로 바꾼다. 저장소 .env는
# 건드리지 않는다(개발 중에는 mock으로 둔다 — docs/05-open-questions.md, 2026-10-19 결정).
# 손으로 고치면 빠뜨리기 쉬워 옵션으로 넣었다(2026-10-21).
if ($ComputeUrl -ne "") {
  if ($ComputeUrl -notmatch '^https?://') {
    throw "연산 서버 주소는 http:// 또는 https:// 로 시작해야 합니다: $ComputeUrl"
  }
  $envPath = Join-Path $OutDir '.env'
  if (-not (Test-Path $envPath)) { throw "패키지에 .env가 없어 연산 서버 주소를 넣을 수 없습니다: $envPath" }

  $url = $ComputeUrl.TrimEnd('/')
  $text = [System.IO.File]::ReadAllText($envPath)
  foreach ($key in @('COMPUTE_MODE', 'COMPUTE_BASE_URL')) {
    if ($text -notmatch "(?m)^$key=") { throw ".env에 $key 줄이 없습니다: $envPath" }
  }
  $text = [regex]::Replace($text, '(?m)^COMPUTE_MODE=.*$', 'COMPUTE_MODE=http')
  $text = [regex]::Replace($text, '(?m)^COMPUTE_BASE_URL=.*$', "COMPUTE_BASE_URL=$url")
  # BOM 없이 쓴다 — .env 첫 줄에 BOM이 붙으면 그 줄의 키 이름이 깨진다.
  [System.IO.File]::WriteAllText($envPath, $text, (New-Object System.Text.UTF8Encoding $false))
  Write-Host "    - 연산 서버: http ($url) — 패키지 .env만 바꿨습니다(저장소 .env는 그대로)"
}
else {
  $envPath = Join-Path $OutDir '.env'
  if (Test-Path $envPath) {
    $mode = ([regex]::Match([System.IO.File]::ReadAllText($envPath), '(?m)^COMPUTE_MODE=(.*)$')).Groups[1].Value.Trim()
    if ($mode -ne 'http') {
      Write-Host "    ! 패키지 .env의 연산 서버가 '$mode' 모드입니다 — 실제 연산 서버로 테스트할 패키지면 -ComputeUrl <주소>를 주세요." -ForegroundColor Yellow
    }
  }
}

# ── 2-b-2. 패키지 .env의 가시화 데이터(COMPUTE_VIZ) ───────────────────────
# -Viz on|off를 주면 **패키지의 .env만** 바꾼다. 줄이 없으면 COMPUTE_BASE_URL 다음에 넣는다
# (저장소 .env에는 COMPUTE_VIZ 줄이 없다 — 기본 꺼짐, env.ts). 연산 서버가 http가 아니면
# 값이 쓰이지 않으므로 알려만 준다.
if ($Viz -ne "") {
  $envPath = Join-Path $OutDir '.env'
  if (-not (Test-Path $envPath)) { throw "패키지에 .env가 없어 가시화 데이터를 설정할 수 없습니다: $envPath" }
  $vizValue = if ($Viz -eq 'on') { 'true' } else { 'false' }
  $text = [System.IO.File]::ReadAllText($envPath)
  if ($text -match '(?m)^COMPUTE_VIZ=') {
    $text = [regex]::Replace($text, '(?m)^COMPUTE_VIZ=.*$', "COMPUTE_VIZ=$vizValue")
  }
  elseif ($text -match '(?m)^COMPUTE_BASE_URL=.*$') {
    $text = [regex]::Replace($text, '(?m)^(COMPUTE_BASE_URL=.*)$',
      "`$1`n# 가시화 데이터(연산 서버 v1.3.3 viz). 켜면 유속을 격자 2,584점으로 받는다 — setup.bat [2/3]`nCOMPUTE_VIZ=$vizValue", 1)
  }
  else { throw ".env에 COMPUTE_BASE_URL 줄이 없어 COMPUTE_VIZ를 넣을 자리를 찾지 못했습니다: $envPath" }
  [System.IO.File]::WriteAllText($envPath, $text, (New-Object System.Text.UTF8Encoding $false))
  $mode = ([regex]::Match($text, '(?m)^COMPUTE_MODE=(.*)$')).Groups[1].Value.Trim()
  Write-Host "    - 가시화 데이터: $Viz (COMPUTE_VIZ=$vizValue) — 패키지 .env만 바꿨습니다"
  if ($mode -ne 'http') {
    Write-Host "    ! 연산 서버가 '$mode' 모드라 가시화 데이터 설정은 쓰이지 않습니다." -ForegroundColor Yellow
  }
}

# ── 2-b2. 납품 빌드본의 bat 안내 문구 ────────────────────────────────────
# 빌드 포함본에는 install.bat이 없다. 그런데 start.bat·check.bat은 폴더가 망가진 경우에
# "install.bat 을 먼저 실행하세요"라고 안내한다 — 없는 파일을 찾게 되므로 납품본에서는
# 압축을 다시 풀도록 바꾼다. 테스트본은 체크리스트가 그 상황을 따로 안내하므로 그대로 둔다.
# bat 파일은 cp949다(첫 줄 chcp 949) — 같은 인코딩으로 읽고 써야 한글이 깨지지 않는다.
if ($Delivery -and -not $Source) {
  $cp949 = [System.Text.Encoding]::GetEncoding(949)
  foreach ($f in @('start.bat', 'check.bat')) {
    $path = Join-Path $OutDir $f
    $text = [System.IO.File]::ReadAllText($path, $cp949)
    if ($text -notmatch 'install\.bat') { throw "$f 에 install.bat 안내가 없습니다 — 스크립트를 확인하세요." }
    $text = $text.Replace('install.bat 을 먼저 실행하세요.', '압축을 다시 풀어 주세요. 그래도 안 되면 개발 측에 문의해 주세요.')
    if ($text -match 'install\.bat') { throw "$f 의 install.bat 안내를 바꾸지 못했습니다(문구가 달라진 것 같습니다)." }
    [System.IO.File]::WriteAllText($path, $text, $cp949)
  }
  Write-Host "    - start.bat·check.bat의 install.bat 안내를 납품본 문구로 바꿨습니다"
}

# ── 2-b3. 납품본 package.json에서 점검 도구 흔적 지우기 ──────────────────
# tests/·playwright.config.ts를 뺐으므로 `npm run test:ui`는 돌 수 없는 명령이 된다.
# 소스본은 `npm install`로 @playwright/test(약 19 MB)까지 받게 되므로 그것도 지운다.
if ($Delivery) {
  $pkgPath = Join-Path $OutDir 'package.json'
  $pkg = Get-Content $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($pkg.scripts.PSObject.Properties['test:ui']) { $pkg.scripts.PSObject.Properties.Remove('test:ui') }
  if ($pkg.PSObject.Properties['devDependencies'] -and $pkg.devDependencies.PSObject.Properties['@playwright/test']) {
    $pkg.devDependencies.PSObject.Properties.Remove('@playwright/test')
  }
  WriteJsonNoBom $pkgPath $pkg
  Write-Host "    - package.json에서 test:ui·@playwright/test 제거"
}

# ── 2-c. 사용 안내의 기상청 키 마감일 ────────────────────────────────────
# 납품본에는 개발 측 명의 키가 들어가므로, 활용 마감일과 재발급 절차를 사용 안내에 박아 둔다.
# 치환이 빠진 채 나가면 "{{KMA_EXPIRY}} 까지"라고 적힌 문서를 보내게 되므로 남아 있으면 멈춘다.
if ($Delivery) {
  $filled = 0
  foreach ($f in @('README.md', 'CLAUDE-구동안내.md')) {
    $path = Join-Path $OutDir $f
    $text = [System.IO.File]::ReadAllText($path)
    $hits = ([regex]::Matches($text, '\{\{KMA_EXPIRY\}\}')).Count
    if ($hits -gt 0) {
      $text = $text.Replace('{{KMA_EXPIRY}}', $KmaKeyExpiry)
      [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding $false))
      $filled += $hits
    }
  }
  if ($filled -eq 0) {
    throw "사용 안내에 {{KMA_EXPIRY}} 자리가 없습니다 — docs/delivery/ 문서를 확인하세요."
  }
  Write-Host "    - 기상청 키 활용 마감일 $KmaKeyExpiry 를 사용 안내 ${filled}곳에 적었습니다"
  foreach ($f in @('README.md', 'CLAUDE-구동안내.md')) {
    $left = [System.IO.File]::ReadAllText((Join-Path $OutDir $f))
    if ($left -match '\{\{') { throw "치환되지 않은 자리표시자가 남았습니다: $f" }
  }
}

if ($Source) {
  Write-Host "[3/4] 소스본이라 의존성을 설치하지 않습니다(받는 쪽이 install.bat으로 설치)." -ForegroundColor DarkGray
} else {
  Write-Host "[3/4] 운영 의존성 설치 중(개발 의존성 제외)..." -ForegroundColor Cyan
  Push-Location $OutDir
  try {
    & npm install --omit=dev --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install 실패" }

    if ($Delivery) {
      Write-Host "      (납품본이라 화면 자동 점검 도구는 넣지 않습니다)" -ForegroundColor DarkGray
    } else {
      # 화면 자동 점검 도구(test-ui.bat이 쓴다). --no-save라 package.json은 그대로 두고
      # node_modules에만 들어간다 — 받는 쪽이 설치를 더 하지 않아도, 인터넷이 없어도 점검이 돈다.
      # 브라우저는 따로 받지 않는다(설치된 Chrome/Edge를 쓴다 — playwright.config.ts 참고).
      Write-Host "      + 화면 자동 점검 도구 @playwright/test@$PlaywrightVersion" -ForegroundColor DarkGray
      # --omit=dev를 빼면 안 된다 — package-lock에 적힌 개발 의존성(typescript·vitest·esbuild 등
      #  약 90 MB)까지 다시 깔려 패키지가 세 배가 된다(2026-10-18 실측 51.7 → 155.7 MB).
      & npm install --omit=dev --no-save --ignore-scripts --no-audit --no-fund "@playwright/test@$PlaywrightVersion"
      if ($LASTEXITCODE -ne 0) { throw "@playwright/test 설치 실패" }
    }
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
if ($Delivery -and $Source) {
  Write-Host "다음: 그 폴더에서 install.bat → start.bat 으로 확인하세요(연결 점검은 check.bat)."
} elseif ($Delivery) {
  Write-Host "다음: 그 폴더에서 start.bat 으로 확인하세요(연결 점검은 check.bat)."
} elseif ($Source) {
  Write-Host "다음: 그 폴더에서 install.bat → start.bat → check.bat → test-ui.bat 순서로 확인하세요."
} else {
  Write-Host "다음: 그 폴더에서 start.bat → check.bat → test-ui.bat 으로 확인하세요."
}
