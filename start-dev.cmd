@echo off
rem Double-click or run: start-dev.cmd   (bypasses the PowerShell execution policy)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" %*
