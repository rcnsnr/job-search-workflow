@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%.." >nul
if errorlevel 1 (
    echo Repository root could not be found. >&2
    exit /b 1
)

if "%~1"=="--help" goto help
if "%~1"=="-h" goto help
if not "%~2"=="" goto invalid_args
if not "%~1"=="" if not "%~1"=="--check-only" goto invalid_args

echo Starting the Job Search Workflow Community Edition setup check...
echo Repository root: %CD%

if not exist README.md (
    echo Required repository file is missing: README.md >&2
    goto fail
)
if not exist .gitignore (
    echo Required repository file is missing: .gitignore >&2
    goto fail
)

set "MISSING="
for %%c in (git python node npm) do (
    where %%c >nul 2>&1
    if errorlevel 1 set "MISSING=!MISSING! %%c"
)

if not "!MISSING!"=="" (
    echo Missing required tools: !MISSING! >&2
    goto fail
)

echo Required tools OK: git python node npm

for /f "tokens=*" %%a in ('python -c "import sys; print(sys.version_info.major)"') do set "PY_MAJOR=%%a"
for /f "tokens=*" %%a in ('python -c "import sys; print(sys.version_info.minor)"') do set "PY_MINOR=%%a"
if !PY_MAJOR! LSS 3 (
    echo Python 3.10 or newer is required. >&2
    goto fail
)
if !PY_MAJOR! EQU 3 if !PY_MINOR! LSS 10 (
    echo Python 3.10 or newer is required. Found: !PY_MAJOR!.!PY_MINOR! >&2
    goto fail
)
echo Python version OK: !PY_MAJOR!.!PY_MINOR!

for /f "tokens=*" %%a in ('node --version') do set "NODE_VERSION=%%a"
set "NODE_VERSION=!NODE_VERSION:v=!"
for /f "tokens=1 delims=." %%a in ("!NODE_VERSION!") do set "NODE_MAJOR=%%a"
for /f "tokens=2 delims=." %%a in ("!NODE_VERSION!") do set "NODE_MINOR=%%a"
if !NODE_MAJOR! LSS 22 (
    echo Node.js 22.12 or newer is required. Found: !NODE_VERSION! >&2
    goto fail
)
if !NODE_MAJOR! EQU 22 if !NODE_MINOR! LSS 12 (
    echo Node.js 22.12 or newer is required. Found: !NODE_VERSION! >&2
    goto fail
)
echo Node.js version OK: !NODE_VERSION!

if "%~1"=="--check-only" (
    echo Check-only mode: setup steps were skipped.
    echo PASS setup-check
    goto success
)

if not exist user_data mkdir user_data
if errorlevel 1 goto fail
if not exist inbox\jobs mkdir inbox\jobs
if errorlevel 1 goto fail
if not exist runs mkdir runs
if errorlevel 1 goto fail
if not exist outputs mkdir outputs
if errorlevel 1 goto fail
if not exist exports mkdir exports
if errorlevel 1 goto fail

if exist fixtures\sample-career_profile.md if not exist user_data\career_profile.md (
    copy fixtures\sample-career_profile.md user_data\career_profile.md >nul
    if errorlevel 1 goto fail
    echo Copied sample profile: user_data\career_profile.md
)

if exist fixtures\sample-target_roles.md if not exist user_data\target_roles.md (
    copy fixtures\sample-target_roles.md user_data\target_roles.md >nul
    if errorlevel 1 goto fail
    echo Copied sample target roles: user_data\target_roles.md
)

if exist scripts\*.py (
    for %%f in (scripts\*.py) do (
        python -m py_compile "%%f"
        if errorlevel 1 goto fail
    )
    echo Python scripts compiled successfully
)

if exist package.json (
    if exist package-lock.json (
        call npm ci
    ) else (
        call npm install
    )
    if errorlevel 1 goto fail
    call npm run --if-present test
    if errorlevel 1 goto fail
)

if exist .git (
    git diff --check
    if errorlevel 1 goto fail
)

echo PASS setup
goto success

:help
echo Usage: %~nx0 [--check-only]
goto success

:invalid_args
echo Unknown or excessive arguments. >&2
echo Usage: %~nx0 [--check-only] >&2
goto fail

:fail
popd >nul
exit /b 1

:success
popd >nul
exit /b 0
