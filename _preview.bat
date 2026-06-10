@echo off
setlocal

:: Set the site root
set "SITE_ROOT=%~dp0output"

:: Clean output directory
if exist "%SITE_ROOT%" rmdir /s /q "%SITE_ROOT%"
mkdir "%SITE_ROOT%"

:: Build the site
pelican content
xcopy extra "%SITE_ROOT%" /E /I /Y >nul

:: Start the development server
start "" "http://localhost:8000/"
start /b "" python -m http.server 8000 -d "%SITE_ROOT%"

:: Keep the command prompt open
endlocal
exit /b