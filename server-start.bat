@echo off
setlocal
cd /d "%~dp0"

echo [INFO] Checking if Deno server is already running...
tasklist /FI "IMAGENAME eq deno.exe" | find /I "deno.exe" >nul
if %errorlevel%==0 (
    echo [INFO] Deno is already running.
    timeout /t 3 >nul
    exit /b
)

echo [INFO] Starting Local Kline Data Provider...
echo [INFO] Server will run in a minimized window.
start "Local Kline Data Provider" /min deno task start

echo [INFO] Server started successfully.
timeout /t 3 >nul
