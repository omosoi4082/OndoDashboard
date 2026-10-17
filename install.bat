@echo off
chcp 949 > nul
cd /d "%~dp0"
title 온도 돈사 대시보드 - 설치

echo ============================================================
echo  온도 돈사 대시보드 - 설치
echo ============================================================
echo.
echo  라이브러리를 내려받고 화면을 빌드합니다.
echo  인터넷 연결이 필요하고, 처음 한 번은 몇 분 걸립니다.
echo.

where node > nul 2>&1
if errorlevel 1 (
  echo [X] Node.js 가 설치되어 있지 않습니다.
  echo.
  echo     https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  echo.
  pause
  exit /b 1
)

echo [1/2] 라이브러리 설치 중...
call npm install
if errorlevel 1 (
  echo.
  echo [X] 설치에 실패했습니다. 인터넷 연결을 확인하고 다시 실행하세요.
  echo     계속 실패하면 이 창의 내용을 그대로 담당자에게 전달하세요.
  echo.
  pause
  exit /b 1
)

echo.
echo [2/2] 화면 빌드 중...
call npm run build
if errorlevel 1 (
  echo.
  echo [X] 빌드에 실패했습니다. 이 창의 내용을 그대로 담당자에게 전달하세요.
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  설치가 끝났습니다.
echo.
echo  다음 순서로 진행하세요:
echo    1) setup.bat  - 기상청 키, 연산 서버 주소를 넣습니다 (이미 되어 있으면 건너뛰세요)
echo    2) start.bat  - 서버를 띄우고 브라우저를 엽니다
echo    3) check.bat  - 연결 상태를 점검합니다
echo ============================================================
echo.
pause
