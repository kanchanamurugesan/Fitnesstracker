@echo off
title Fitness Tracker
cd /d "%~dp0"

REM Build the web app once if it hasn't been built yet.
if not exist "client\dist\index.html" (
  echo Building the app for the first time, please wait...
  cd client
  call npm run build
  cd ..
)

REM Start the server (serves the app + API on port 4000).
cd server
node src/index.js

REM Keep the window open if the server stops or errors.
echo.
echo The app has stopped. Close this window or press a key to exit.
pause >nul
