# ==============================================================================
# CodexConfigManager - Ejecutor de Pruebas Unitarias, Seguridad y E2E
# ==============================================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Host "`n[TEST SUITE] Iniciando validación completa de CodexConfigManager 2.1..." -ForegroundColor Cyan

# 1. Pruebas Unitarias de Motor TOML
Write-Host "`n>>> 1/3: Ejecutando Pruebas Unitarias del Motor TOML..." -ForegroundColor Yellow
node (Join-Path $ProjectRoot "tests\toml-engine.test.mjs")
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallaron las pruebas unitarias del motor TOML."
    exit $LASTEXITCODE
}

# 2. Pruebas de Seguridad y Hardening
Write-Host "`n>>> 2/3: Ejecutando Batería de Seguridad y Hardening..." -ForegroundColor Yellow
node (Join-Path $ProjectRoot "tests\security.test.mjs")
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallaron las pruebas de seguridad."
    exit $LASTEXITCODE
}

# 3. Pruebas E2E de Playwright (Chromium Aislado)
Write-Host "`n>>> 3/3: Ejecutando Batería de Pruebas E2E (Playwright Chromium)..." -ForegroundColor Yellow
node (Join-Path $ProjectRoot "tests\e2e.test.mjs")
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallaron las pruebas E2E."
    exit $LASTEXITCODE
}

Write-Host "`n[TEST SUITE] Todas las pruebas (Unitarias, Seguridad y E2E) finalizaron con éxito.`n" -ForegroundColor Green
