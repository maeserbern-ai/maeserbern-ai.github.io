@echo off
cd /d "%~dp0"
echo Ingredient Dictionary: The Party Game - iPhone/iPad build
echo.
echo Installing and packing the game...
call "C:\Program Files\nodejs\npm.cmd" install
if errorlevel 1 (
  echo Install failed.
  pause
  exit /b 1
)
echo.
echo Building on Expo's servers and uploading to App Store Connect / TestFlight.
echo The first time, EAS asks for your Apple login and creates the new app,
echo its certificate and profile. Your other apps are not changed.
"%APPDATA%\npm\eas.cmd" build --profile production --platform ios --auto-submit
echo.
pause
