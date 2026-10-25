<#
.SYNOPSIS
  Start the MindPulse backend (Django + emotion model) and the mobile app together.

.DESCRIPTION
  One command, two processes:
    1. Django dev server on 0.0.0.0:<Port>  (runs the hybrid emotion model)
    2. Expo dev server for mindpulse-mobile
  Ctrl+C stops Expo and the backend this script started.

.PARAMETER Port
  Backend port (default 8000).

.PARAMETER NoBackend
  Only start Expo (assumes the backend is already running).

.PARAMETER NoExpo
  Only start the backend, then wait for Enter.

.PARAMETER DryRun
  Run the checks and print what would happen, without starting anything.

.EXAMPLE
  .\dev.ps1
.EXAMPLE
  .\dev.ps1 -Port 8001
#>
[CmdletBinding()]
param(
  [int]$Port = 8000,
  [switch]$NoBackend,
  [switch]$NoExpo,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root 'mindpulse-backend'
$mobile  = Join-Path $root 'mindpulse-mobile'

function Fail([string]$Message) {
  Write-Host "ERROR: $Message" -ForegroundColor Red
  exit 1
}

function Test-PortListening([int]$P) {
  return [bool](Get-NetTCPConnection -LocalPort $P -State Listen -ErrorAction SilentlyContinue)
}

function Get-LanIp {
  $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } |
    Sort-Object -Property InterfaceMetric |
    Select-Object -First 1 -ExpandProperty IPAddress
  if ($ip) { return $ip } else { return '<your-PC-LAN-IP>' }
}

# --- checks ---------------------------------------------------------------
if (-not (Test-Path $backend)) { Fail "backend folder not found: $backend" }
if (-not (Test-Path $mobile))  { Fail "mobile folder not found: $mobile" }

# Prefer the backend venv: it holds the emotion-model deps (tensorflow, keras,
# mediapipe, opencv, scikit-learn). System Python may only have Django, which
# starts the server but fails every face scan with HTTP 503 "Emotion model
# unavailable." — so only fall back to PATH python when there is no venv.
$venvPython = Join-Path $backend 'venv\Scripts\python.exe'
$pythonCmd  = Get-Command python -ErrorAction SilentlyContinue
if (Test-Path $venvPython) {
  $pythonPath = $venvPython
} elseif ($pythonCmd) {
  $pythonPath = $pythonCmd.Source
} else {
  $pythonPath = $null
}
if (-not $NoBackend -and -not $pythonPath) {
  Fail "python not found on PATH and no venv at $venvPython (create it: python -m venv venv; then pip install -r requirements.txt)"
}

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $NoExpo -and -not $npm) { Fail "npm not found on PATH" }

# --- backend URL guidance -------------------------------------------------
$envFile = Join-Path $mobile '.env'
$hasApiUrl = $false
if (Test-Path $envFile) {
  $hasApiUrl = [bool](Get-Content $envFile |
    Where-Object { $_ -match '^\s*EXPO_PUBLIC_MINDPULSE_API_URL\s*=\s*\S' } |
    Select-Object -First 1)
}

if ($hasApiUrl) {
  Write-Host "OK  EXPO_PUBLIC_MINDPULSE_API_URL is set in mindpulse-mobile\.env" -ForegroundColor Green
} else {
  $lanIp = Get-LanIp
  if ($lanIp -ne '<your-PC-LAN-IP>' -and -not $DryRun) {
    Add-Content -Path $envFile -Value "EXPO_PUBLIC_MINDPULSE_API_URL=http://${lanIp}:$Port"
    Write-Host "OK  Wrote the local phone backend URL to mindpulse-mobile\.env ($lanIp`:$Port)" -ForegroundColor Green
  } else {
    Write-Host "WARN  EXPO_PUBLIC_MINDPULSE_API_URL is not set in mindpulse-mobile\.env" -ForegroundColor Yellow
    Write-Host "      Physical phone: http://$(Get-LanIp):$Port"
    Write-Host "      Android emulator: http://10.0.2.2:$Port"
    Write-Host "      Web / iOS simulator: http://localhost:$Port"
  }
}

# --- backend --------------------------------------------------------------
$backendProc  = $null
$backendOwned = $false

if ($NoBackend) {
  Write-Host "Skipping backend (-NoBackend)." -ForegroundColor DarkGray
} elseif (Test-PortListening $Port) {
  Write-Host "Port $Port already in use - assuming the backend is already running; it will not be stopped." -ForegroundColor Yellow
} elseif ($DryRun) {
  Write-Host "DRYRUN  would start: python manage.py runserver 0.0.0.0:$Port --noreload (in $backend)" -ForegroundColor Cyan
} else {
  Write-Host "Starting Django backend on 0.0.0.0:$Port ..." -ForegroundColor Cyan
  $backendProc = Start-Process -FilePath $pythonPath `
    -ArgumentList @('manage.py', 'runserver', "0.0.0.0:$Port", '--noreload') `
    -WorkingDirectory $backend -PassThru
  $backendOwned = $true

  $deadline = (Get-Date).AddSeconds(60)
  while (-not (Test-PortListening $Port)) {
    if ($backendProc.HasExited) {
      Fail "backend exited early (code $($backendProc.ExitCode)). Try: pip install -r `"$backend\requirements.txt`""
    }
    if ((Get-Date) -gt $deadline) {
      Fail "backend did not start listening on port $Port within 60s"
    }
    Start-Sleep -Milliseconds 500
  }
  Write-Host "Backend ready: http://localhost:$Port/api/predict-emotion/" -ForegroundColor Green
}

# --- expo / wait ----------------------------------------------------------
try {
  if ($NoExpo) {
    if ($DryRun) {
      Write-Host "DRYRUN  would wait for Enter, then stop the backend." -ForegroundColor Cyan
    } else {
      Write-Host "Press Enter to stop the backend..." -ForegroundColor Cyan
      [void](Read-Host)
    }
  } elseif ($DryRun) {
    Write-Host "DRYRUN  would run: npm start (in $mobile)" -ForegroundColor Cyan
  } else {
    Write-Host "Starting Expo - press Ctrl+C to stop everything ..." -ForegroundColor Cyan
    Push-Location $mobile
    npm start
  }
}
finally {
  if ((Get-Location).Path -eq $mobile) { Pop-Location }
  if ($backendOwned -and $backendProc -and -not $backendProc.HasExited) {
    Write-Host "Stopping backend (PID $($backendProc.Id)) ..." -ForegroundColor Yellow
    Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
  }
}
