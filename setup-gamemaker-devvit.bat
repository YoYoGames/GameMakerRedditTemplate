@echo off
setlocal enabledelayedexpansion

:: GameMaker to Devvit Setup Script
:: Usage: setup-gamemaker-devvit.bat "path\to\gamemaker\export\directory" "project-name"

if "%~1"=="" (
    echo Error: Please provide the GameMaker export directory path
    echo Usage: %0 "path\to\gamemaker\export\directory" "project-name"
    echo Example: %0 "C:\path\to\mygame_12345_VM" "my-awesome-game"
    exit /b 1
)

if "%~2"=="" (
    echo Error: Please provide a project name
    echo Usage: %0 "path\to\gamemaker\export\directory" "project-name"
    echo Example: %0 "C:\path\to\mygame_12345_VM" "my-awesome-game"
    exit /b 1
)

set GAMEMAKER_DIR=%~1
set PROJECT_NAME=%~2
set RUNNER_DIR=%GAMEMAKER_DIR%\runner
set CLIENT_PUBLIC=%cd%\src\client\public

:: Check if GameMaker directory exists
if not exist "%GAMEMAKER_DIR%" (
    echo Error: GameMaker directory does not exist: %GAMEMAKER_DIR%
    exit /b 1
)

:: Check if runner directory exists
if not exist "%RUNNER_DIR%" (
    echo Error: Runner directory does not exist: %RUNNER_DIR%
    exit /b 1
)

:: Check if we're in a Devvit project directory
if not exist "src\client\public" (
    echo Error: This doesn't appear to be a Devvit project directory
    echo Make sure you're running this script from the root of your Devvit project
    exit /b 1
)

echo Setting up GameMaker game in Devvit project...
echo GameMaker directory: %GAMEMAKER_DIR%
echo Project name: %PROJECT_NAME%
echo Devvit project: %cd%

:: Create game directory if it doesn't exist
if not exist "%CLIENT_PUBLIC%\game" (
    echo Creating game directory...
    mkdir "%CLIENT_PUBLIC%\game"
)

:: Copy all files from runner directory to game directory
echo Copying GameMaker files to game directory...
xcopy "%RUNNER_DIR%\*" "%CLIENT_PUBLIC%\game\" /Y /Q

:: Copy specific files to root of public directory (required by GameMaker runtime)
echo Copying required files to public root...
copy "%RUNNER_DIR%\runner.data" "%CLIENT_PUBLIC%\runner.data" >nul
copy "%RUNNER_DIR%\runner.wasm" "%CLIENT_PUBLIC%\runner.wasm" >nul
copy "%RUNNER_DIR%\audio-worklet.js" "%CLIENT_PUBLIC%\audio-worklet.js" >nul
copy "%RUNNER_DIR%\game.unx" "%CLIENT_PUBLIC%\game.unx" >nul
copy "%RUNNER_DIR%\runner.js" "%CLIENT_PUBLIC%\runner.js" >nul

:: Replace template placeholders with project name
echo Replacing template placeholders...

:: Replace in package.json
if exist "package.json" (
    echo Updating package.json...
    powershell -Command "(Get-Content 'package.json') -replace '<%%\s*name\s*%%>', '%PROJECT_NAME%' | Set-Content 'package.json'"
)

:: Replace in devvit.json
if exist "devvit.json" (
    echo Updating devvit.json...
    powershell -Command "(Get-Content 'devvit.json') -replace '<%%\s*name\s*%%>', '%PROJECT_NAME%' | Set-Content 'devvit.json'"
)

:: Replace in server post.ts
if exist "src\server\core\post.ts" (
    echo Updating post.ts...
    powershell -Command "(Get-Content 'src\server\core\post.ts') -replace '<%%\s*name\s*%%>', '%PROJECT_NAME%' | Set-Content 'src\server\core\post.ts'"
)

echo.
echo GameMaker game setup complete!
echo.
echo Project configured:
echo - Name: %PROJECT_NAME%
echo - GameMaker files: Copied
echo - Template placeholders: Replaced
echo.
echo Next steps:
echo 1. Run "npm install" if you haven't already
echo 2. Run "npm run dev" to start the development server
echo 3. Your GameMaker game should now load in the Devvit app
echo.
echo Files copied:
echo - All GameMaker files → src\client\public\game\
echo - Core runtime files → src\client\public\ (root level)
echo.

pause