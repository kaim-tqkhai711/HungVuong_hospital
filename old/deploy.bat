@echo off
REM Deployment Script Wrapper for Hệ thống Theo dõi Chuyển dạ - Bệnh viện Hùng Vương
REM This batch file runs the PowerShell deployment script

echo ================================
echo Hungvuong Partogram System
echo Deployment Script
echo ================================
echo.

REM Check if PowerShell is available
where powershell >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PowerShell not found!
    echo Please install PowerShell to use this deployment script.
    pause
    exit /b 1
)

REM Ask for deployment environment
echo Select deployment environment:
echo 1. Development (default)
echo 2. Production
echo.
set /p choice="Enter your choice (1 or 2): "

if "%choice%"=="2" (
    set DEPLOY_ENV=production
) else (
    set DEPLOY_ENV=development
)

echo.
echo Deploying in %DEPLOY_ENV% mode...
echo.

REM Run the PowerShell script
powershell.exe -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" -DeployEnv %DEPLOY_ENV%

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Deployment failed!
    pause
    exit /b 1
)

echo.
echo Deployment completed successfully!
pause
