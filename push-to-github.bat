@echo off
cd /d C:\Users\ADMIN\Desktop\TracuuSP
git rm --cached tracuusp-aea0e138fab8.json
git add .gitignore
git commit -m "Remove service account key file from repository"
git push -u origin main
pause
