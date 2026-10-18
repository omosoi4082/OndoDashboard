@echo off
chcp 949 > nul
cd /d "%~dp0"
title 온도 돈사 대시보드 - 화면 자동 점검

echo ============================================================
echo  화면 자동 점검 (테스트 체크리스트 B부)
echo ------------------------------------------------------------
echo  크롬 창이 저절로 열리고 닫히기를 반복합니다. 3분쯤 걸리니
echo  창을 닫거나 마우스로 건드리지 마시고 그대로 두세요.
echo  끝나면 "화면점검결과.txt" 파일이 이 폴더에 생깁니다.
echo ============================================================
echo.

where node > nul 2>&1
if errorlevel 1 (
  echo [X] Node.js 가 설치되어 있지 않습니다. https://nodejs.org 에서 LTS 버전을 설치하세요.
  echo.
  pause
  exit /b 1
)

if not exist "apps\dashboard\dist\index.html" (
  echo [X] 화면 빌드 결과가 없습니다. install.bat 을 먼저 실행하세요.
  echo.
  pause
  exit /b 1
)

rem 점검 도구(@playwright/test)가 없으면 받아 둔다. 전달 패키지에는 넣어 두었으므로
rem 보통 이 단계는 건너뛴다 - 소스만 받았거나 지웠을 때만 설치한다.
if not exist "node_modules\@playwright\test" (
  echo 점검 도구를 내려받는 중입니다. 처음 한 번만 하며 1~2분 걸립니다...
  call npm install --no-save --no-audit --no-fund @playwright/test@1.64.1
  if errorlevel 1 (
    echo.
    echo [X] 점검 도구 설치에 실패했습니다. 인터넷 연결을 확인해 주세요.
    echo.
    pause
    exit /b 1
  )
)

call npx playwright test
set RESULT=%ERRORLEVEL%

echo.
echo ============================================================
if "%RESULT%"=="0" (
  echo  모든 항목이 정상입니다.
) else (
  echo  일부 항목이 실패했습니다. "화면점검결과.txt" 를 열어 확인하고,
  echo  그 파일과 "ui-test-results" 폴더를 그대로 보내 주세요.
)
echo  결과 파일 : 화면점검결과.txt
echo ============================================================
echo.
pause
