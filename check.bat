@echo off
chcp 949 > nul
cd /d "%~dp0"
title 온도 돈사 대시보드 - 상태 점검

where node > nul 2>&1
if errorlevel 1 (
  echo [X] Node.js 가 설치되어 있지 않습니다. https://nodejs.org 에서 LTS 버전을 설치하세요.
  echo.
  pause
  exit /b 1
)

if not exist "apps\relay\dist\scripts\doctor.js" (
  echo [X] 점검 도구가 없습니다. install.bat 을 먼저 실행하세요.
  echo.
  pause
  exit /b 1
)

echo 점검 중입니다. 연산에 시간이 걸려 1~3분 정도 걸릴 수 있습니다. 기다려 주세요...
echo.

rem 한 번만 실행해 파일로 받고, 그 파일을 화면에 보여준다.
rem (예전에는 화면용과 파일용으로 두 번 돌려서 시간이 두 배로 걸렸다.)
npm run doctor > "점검결과.txt" 2>&1
type "점검결과.txt"

echo.
echo ============================================================
echo  점검 결과를 "점검결과.txt" 파일로도 저장했습니다.
echo  오류가 있으면 이 파일을 담당자에게 보내 주세요.
echo ============================================================
echo.
pause
