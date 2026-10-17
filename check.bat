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

rem 점검 결과를 파일로도 남긴다 - 오류 보고 시 이 파일을 그대로 보내면 된다.
npm run doctor 2>&1 | more
npm run doctor > "점검결과.txt" 2>&1

echo.
echo ============================================================
echo  점검 결과를 "점검결과.txt" 파일로도 저장했습니다.
echo  오류가 있으면 이 파일을 담당자에게 보내 주세요.
echo ============================================================
echo.
pause
