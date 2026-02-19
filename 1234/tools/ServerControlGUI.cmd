@echo off

set SCRIPT_DIR=C:\qq\1234\tools

set SCRIPT=%SCRIPT_DIR%\ServerControl.ps1



if not exist "%SCRIPT%" (

    echo [ERROR] ServerControl.ps1 ???????? ????????. (%SCRIPT%)

    pause

    exit /b 1

)



powershell -NoLogo -ExecutionPolicy Bypass -File "%SCRIPT%"

