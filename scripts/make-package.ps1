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
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

if ($OutDir -eq "") {
  $stamp = Get-Date -Format 'yyyyMMdd'
  $OutDir = Join-Path (Split-Path -Parent $repo) "ondo-dashboard-$stamp"
}

Write-Host "저장소 : $repo"
Write-Host "패키지 : $OutDir"
Write-Host ""

# ── 1. 빌드 ────────────────────────────────────────────────────────────────
if (-not $SkipBuild) {
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

# 루트 파일 — .env를 **반드시 포함**한다(2026-10-17 결정: 기상청 키를 전달 패키지로 넘긴다).
# install.bat은 넣지 않는다: 이 패키지에는 소스가 없어 `npm run build`가 실패한다.
# (소스본을 따로 만들 때만 넣는다 — docs/08-development.md)
$rootFiles = @(
  'package.json', 'package-lock.json',
  '.env', '.env.example',
  'start.bat', 'check.bat', 'setup.bat',
  'README.md', '테스트-체크리스트.md', 'CLAUDE-구동안내.md'
)
foreach ($f in $rootFiles) {
  if (Test-Path $f) { Copy-Item $f -Destination $OutDir }
  else { Write-Host "    ! 없음: $f" -ForegroundColor Yellow }
}

# 런타임에 읽는 데이터
foreach ($d in @('config', 'mock')) {
  Copy-Item $d -Destination (Join-Path $OutDir $d) -Recurse
}

# 워크스페이스 — package.json과 빌드 결과만(소스는 넣지 않는다).
# ★ apps\dashboard는 **워크스페이스에서 뺀다**. 대시보드는 정적 파일(dist)로만 나가고
#   three·react·lucide-react 같은 의존성은 이미 번들(dist/assets/index-*.js)에 들어 있다.
#   package.json을 넣으면 npm이 그 의존성(약 220 MB)까지 설치해 패키지가 쓸데없이 커진다.
#   중계 서버는 apps/dashboard/dist **폴더만** 보므로 package.json이 필요 없다.
foreach ($ws in @('apps\relay', 'packages\shared')) {
  $dst = Join-Path $OutDir $ws
  New-Item -ItemType Directory -Path $dst -Force | Out-Null
  Copy-Item (Join-Path $ws 'package.json') -Destination $dst
  $dist = Join-Path $ws 'dist'
  if (Test-Path $dist) { Copy-Item $dist -Destination (Join-Path $dst 'dist') -Recurse }
  else { throw "빌드 결과가 없습니다: $dist  (npm run build를 먼저 실행하세요)" }
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
Write-Host "[3/4] 운영 의존성 설치 중(개발 의존성 제외)..." -ForegroundColor Cyan
Push-Location $OutDir
try {
  & npm install --omit=dev --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm install 실패" }
} finally { Pop-Location }

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
Write-Host "다음: 그 폴더에서 start.bat → check.bat 으로 확인하세요."
