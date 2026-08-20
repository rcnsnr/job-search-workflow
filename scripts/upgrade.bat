@echo off
setlocal enabledelayedexpansion

set "UPSTREAM_URL=https://github.com/rcnsnr/job-search-workflow.git"
set "UPSTREAM_API=https://api.github.com/repos/rcnsnr/job-search-workflow/releases/latest"
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "DEFAULT_SOURCE_ROOT=%%~fI"
set "SOURCE_ROOT=%DEFAULT_SOURCE_ROOT%"
set "TAG=%~1"
if "%TAG%"=="--help" goto help
if "%TAG%"=="-h" goto help

if "%~2"=="" goto args_done
if not "%~2"=="--source" goto invalid_args
if "%~3"=="" (
    echo --source requires a workspace path. >&2
    goto fail
)
if not "%~4"=="" goto invalid_args
set "SOURCE_ROOT=%~3"

:args_done
for %%I in ("%SOURCE_ROOT%") do set "SOURCE_ROOT=%%~fI"
for %%I in ("%SOURCE_ROOT%\..") do set "PARENT_DIR=%%~fI"

if "%TAG%"=="" (
    for /f "delims=" %%a in ('python -c "import json, urllib.request; print(json.load(urllib.request.urlopen('%UPSTREAM_API%', timeout=20))['tag_name'])"') do set "TAG=%%a"
    if errorlevel 1 goto fail
) else (
    set "TAG=%~1"
)

echo Requested release: %TAG%
echo(%TAG%| findstr /r /x "v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*" >nul
if errorlevel 1 (
    echo Release tag must use vX.Y.Z format. >&2
    goto fail
)

if not exist "%SOURCE_ROOT%\README.md" (
    echo Repository root could not be verified. >&2
    goto fail
)
if not exist "%SOURCE_ROOT%\.git" (
    echo Run this script from a Git clone. >&2
    goto fail
)

for /f "delims=" %%a in ('python -c "from datetime import datetime; print(datetime.now().strftime('%%Y%%m%%d-%%H%%M%%S'))"') do set "STAMP=%%a"
set "BACKUP_DIR=%PARENT_DIR%\job-search-workflow-backups\%STAMP%-%TAG%"
set "RELEASE_DIR=%PARENT_DIR%\job-search-workflow-%TAG%"

if exist "%BACKUP_DIR%" (
    echo Backup path already exists: %BACKUP_DIR% >&2
    goto fail
)
if exist "%RELEASE_DIR%" (
    echo Release path already exists: %RELEASE_DIR% >&2
    goto fail
)

mkdir "%BACKUP_DIR%"
if errorlevel 1 goto fail
echo Creating backup at: %BACKUP_DIR%
call :copy_personal "%SOURCE_ROOT%" "%BACKUP_DIR%"
if errorlevel 1 goto fail

echo Cloning %TAG% into: %RELEASE_DIR%
git clone --branch "%TAG%" --single-branch "%UPSTREAM_URL%" "%RELEASE_DIR%"
if errorlevel 1 goto fail

echo Copying personal data into the new release workspace...
call :copy_personal "%SOURCE_ROOT%" "%RELEASE_DIR%"
if errorlevel 1 goto fail

echo Checking the new release prerequisites...
call "%RELEASE_DIR%\scripts\setup.bat" --check-only
if errorlevel 1 goto fail

echo PASS upgrade
echo Backup: %BACKUP_DIR%
echo New workspace: %RELEASE_DIR%
echo Original workspace: %SOURCE_ROOT%
echo.
echo Your original workspace was not changed. To start the new dashboard:
echo   cd /d "%RELEASE_DIR%"
echo   python -m pip install -e ".[dashboard]"
echo   python -m jsw dashboard
exit /b 0

:copy_personal
for %%D in (user_data inbox exports outputs runs) do (
    if exist "%~1\%%D" (
        xcopy "%~1\%%D" "%~2\%%D\" /E /I /H /K /Y >nul
        if errorlevel 1 exit /b 1
        echo Copied personal directory: %%D
    )
)
exit /b 0

:help
echo Usage: %~nx0 [vX.Y.Z] [--source C:\path\to\current-workspace]
echo Creates a backup and a separate release clone without changing this workspace.
exit /b 0

:invalid_args
echo Only one optional release tag is accepted. >&2

:fail
exit /b 1
