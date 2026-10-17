@echo off
chcp 949 > nul
cd /d "%~dp0"
title 온도 돈사 대시보드 - 설정

where node > nul 2>&1
if errorlevel 1 (
  echo [X] Node.js 가 설치되어 있지 않습니다. https://nodejs.org 에서 LTS 버전을 설치하세요.
  echo.
  pause
  exit /b 1
)

if not exist "appselay\dist\scripts\setup.js" (
  echo [!] 설정 도구가 없습니다. install.bat 을 먼저 실행하세요.
  echo.
  pause
  exit /b 1
)

npm run setup

echo.
pause
