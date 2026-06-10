@echo off
setlocal

:: Push source code to main
git checkout main

git status

set /p MSG="Commit message: "

git add -A
git commit -m "%MSG%"
git push origin main

pause