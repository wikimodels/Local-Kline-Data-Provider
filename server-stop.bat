@echo off
setlocal
cd /d "%~dp0"

echo [INFO] Attempting graceful shutdown...
deno run --allow-net --allow-env --allow-read shutdown-server.ts

if %errorlevel% neq 0 (
    echo [WARN] Graceful shutdown failed (Server might not be running or hanging).
    echo [INFO] Forcing cleanup of any stray 'deno.exe' processes...
    taskkill /IM deno.exe /F 2>nul
) else (
    echo [INFO] Graceful shutdown request sent.
)

timeout /t 3 >nul
