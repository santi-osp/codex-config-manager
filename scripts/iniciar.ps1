# ==============================================================================
# CodexConfigManager - Script de Inicio Rápido (Windows / PowerShell)
# ==============================================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$ServerScript = Join-Path $ProjectRoot "src\server\config-manager-server.mjs"
$WebIndex = Join-Path $ProjectRoot "src\web\index.html"
$IconPath = Join-Path $ProjectRoot "assets\codex-config-icon.ico"
$Port = 20129

Write-Host "`n[CodexConfigManager 2.0] Verificando entorno..." -ForegroundColor Cyan

# 1. Verificar Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js no se encuentra instalado o no está en el PATH del sistema."
    exit 1
}

# 2. Verificar si el servidor local ya está escuchando en el puerto 20129
$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
    Write-Host "[Servidor] Iniciando config-manager-server en puerto $Port..." -ForegroundColor Yellow
    $nodePath = (Get-Command node).Source
    Start-Process -FilePath $nodePath -ArgumentList "`"$ServerScript`"" -WorkingDirectory $ProjectRoot -WindowStyle Hidden
    Start-Sleep -Milliseconds 800
    
    $check = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($check) {
        Write-Host "[Servidor] Operativo en http://127.0.0.1:$Port (PID: $($check.OwningProcess))" -ForegroundColor Green
    } else {
        Write-Warning "[Servidor] No se detectó escucha inmediata en puerto $Port. Comprueba los logs."
    }
} else {
    Write-Host "[Servidor] Ya se encuentra en ejecución en http://127.0.0.1:$Port (PID: $($listening.OwningProcess))" -ForegroundColor Green
}

# 3. Verificar estado de OmniRoute en puerto 20128
$omni = Get-NetTCPConnection -LocalPort 20128 -State Listen -ErrorAction SilentlyContinue
if ($omni) {
    Write-Host "[OmniRoute] Servicio activo detectado en puerto 20128" -ForegroundColor Green
} else {
    Write-Warning "[OmniRoute] No detectado en puerto 20128. Inicia OmniRoute para habilitar el despacho de modelos."
}

# 4. Lanzar Interfaz de Escritorio en Microsoft Edge (App Mode)
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (Test-Path $edgePath) {
    Write-Host "[UI] Abriendo panel de control en Microsoft Edge (App Mode)..." -ForegroundColor Cyan
    Start-Process -FilePath $edgePath -ArgumentList "--app=`"http://127.0.0.1:$Port/`""
} else {
    Write-Host "[UI] Abriendo interfaz en el navegador predeterminado..." -ForegroundColor Cyan
    Start-Process "http://127.0.0.1:$Port"
}

Write-Host "[CodexConfigManager] Sistema listo.`n" -ForegroundColor Green
