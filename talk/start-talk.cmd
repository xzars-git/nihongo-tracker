@echo off
rem Starts Talk (local only) and opens it in the browser. Close this window to stop it.
cd /d "%~dp0"
title Talk - local Japanese tutor
python -X utf8 -I server.py --open
pause
