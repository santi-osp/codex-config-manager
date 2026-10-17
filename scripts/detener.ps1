# ==============================================================================
# CodexConfigManager - Script de Detención Limpia (Windows / PowerShell)
# ==============================================================================

$Port = 20129
Write-Host "`n[CodexConfigManager] Buscando procesos en puerto $Port..." -ForegroundColor Cyan

$conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($conns) {
    foreach ($conn in $conns) {
        $pidToKill = $conn.OwningProcess
        try {
            $proc = Get-Process -Id $pidToKill -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "[Servidor] Deteniendo proceso $($proc.ProcessName) (PID: $pidToKill)..." -ForegroundColor Yellow
                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                Write-Host "[Servidor] Proceso $pidToKill detenido con éxito." -ForegroundColor Green
            }
        } catch {
            Write-Warning "No se pudo detener el proceso ${pidToKill}: $($_.Exception.Message)"
        }
    }
} else {
    Write-Host "[Servidor] No hay ningún proceso escuchando en el puerto $Port." -ForegroundColor Green
}
Write-Host ""
