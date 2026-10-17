@echo off
chcp 949 > nul
cd /d "%~dp0"
title 온도 돈사 대시보드 - 실행 중 (이 창을 닫으면 종료됩니다)

echo ============================================================
echo  온도 돈사 대시보드 - 실행
echo ============================================================
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

if not exist ".env" (
  echo [X] 설정 파일(.env)이 없습니다.
  echo.
  echo     setup.bat 을 먼저 실행해 설정을 만드세요.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [!] 라이브러리가 설치되어 있지 않습니다. install.bat 을 먼저 실행하세요.
  echo.
  pause
  exit /b 1
)

if not exist "apps\dashboard\dist\index.html" (
  echo [!] 화면 빌드 결과가 없어 지금 빌드합니다. 처음 한 번은 몇 분 걸립니다...
  echo.
  call npm run build
  if errorlevel 1 (
    echo.
    echo [X] 빌드에 실패했습니다. 이 창의 내용을 그대로 담당자에게 전달하세요.
    echo.
    pause
    exit /b 1
  )
  echo.
)

echo  브라우저가 자동으로 열립니다. 열리지 않으면 아래 주소를 직접 입력하세요:
echo    http://localhost:8080
echo.
echo  종료하려면 이 창을 닫으세요.
echo ============================================================
echo.

rem 서버가 뜨는 데 몇 초 걸리므로 브라우저를 조금 늦게 연다.
start "" /b cmd /c "timeout /t 5 /nobreak > nul & start http://localhost:8080"

npm start

echo.
echo [!] 서버가 종료되었습니다. 위에 오류 메시지가 있으면 그대로 전달하세요.
pause
