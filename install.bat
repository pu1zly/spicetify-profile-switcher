@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo     Installing Spotify Profile Switcher
echo ===================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is required but not found in PATH!
    echo Please install Node.js from https://nodejs.org/ and try again.
    pause
    exit /b 1
)

:: 2. Check Spicetify
where spicetify >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Spicetify CLI is not found in PATH!
    echo Please ensure Spicetify is installed: https://spicetify.app/
    pause
    exit /b 1
)

:: 3. Setup ~/.spotify-profiles
set "TARGET_DIR=%USERPROFILE%\.spotify-profiles"
if not exist "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%"
)

echo [*] Copying background helper files to %TARGET_DIR%...
copy /y "%~dp0server.js" "%TARGET_DIR%\server.js" >nul
copy /y "%~dp0start-server.vbs" "%TARGET_DIR%\start-server.vbs" >nul

:: 4. Copy Extension to Spicetify
for /f "delims=" %%I in ('spicetify path -e 2^>nul') do set "SPICETIFY_EXT=%%I"
if not exist "%SPICETIFY_EXT%" (
    set "SPICETIFY_EXT=%APPDATA%\spicetify\Extensions"
)

echo [*] Installing extension to %SPICETIFY_EXT%...
copy /y "%~dp0profile-switcher.js" "%SPICETIFY_EXT%\profile-switcher.js" >nul

:: 5. Register Startup Run Key
echo [*] Adding silent helper to Windows startup...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "SpotifyProfileSwitcher" /t REG_SZ /d "wscript.exe \"%TARGET_DIR%\start-server.vbs\"" /f >nul

:: 6. Launch Helper now
echo [*] Launching background helper service...
wscript.exe "%TARGET_DIR%\start-server.vbs"

:: 7. Apply Spicetify extension
echo [*] Enabling extension in Spicetify...
spicetify config extensions profile-switcher.js
echo [*] Applying Spicetify modifications...
spicetify apply

echo.
echo ===================================================
echo   Installation Complete!
echo   Open Spotify to use your Profile Switcher!
echo ===================================================
echo.
pause
