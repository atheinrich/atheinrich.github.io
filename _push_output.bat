@echo off
setlocal

:: Generate the site
if exist output rmdir /s /q output
pelican content
xcopy extra output /E /I /Y >nul

:: Deploy the generated site to output branch
ghp-import output -b output
git fetch origin output
git push origin output --force-with-lease

pause