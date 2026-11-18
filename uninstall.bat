@echo off
setlocal

echo ===================================================
echo     Uninstalling Spotify Profile Switcher
echo ===================================================
echo.

:: Stop Node server
taskkill /F /FI "WINDOWTITLE eq SpotifyProfileSwitcher*" >nul 2>nul

:: Remove startup registry key
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "SpotifyProfileSwitcher" /f >nul 2>nul

:: Remove extension from Spicetify
where spicetify >nul 2>nul
if %errorlevel% equ 0 (
    echo [*] Disabling Spicetify extension...
    spicetify config extensions profile-switcher.js-
    spicetify apply
)

echo.
echo ===================================================
echo   Uninstalled successfully!
echo   (Saved profiles in %USERPROFILE%\.spotify-profiles were preserved)
echo ===================================================
echo.
pause
