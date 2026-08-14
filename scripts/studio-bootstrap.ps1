<#
.SYNOPSIS
    Bootstraps the Loom Studio stack on Windows for Blackwell GPUs (RTX 50-series).

.DESCRIPTION
    Installs ffmpeg, clones ComfyUI and FaceFusion, installs a CUDA 12.8+ PyTorch
    build (the part that breaks most 50-series installs), and sets up the studio
    orchestrator venv.

    Idempotent: re-running skips anything already present. Model weights are NOT
    downloaded — see docs/studio/model-matrix.md for what to fetch.

.PARAMETER Root
    Install root. Use a data drive, not C:. Default D:\ai

.PARAMETER TorchIndex
    PyTorch wheel index. Must be a CUDA 12.8+ build for sm_120.

.PARAMETER SkipClones
    Only set up the studio venv and verify torch.

.EXAMPLE
    .\scripts\studio-bootstrap.ps1 -Root D:\ai

.EXAMPLE
    # If the stable wheel still refuses the card:
    .\scripts\studio-bootstrap.ps1 -TorchIndex https://download.pytorch.org/whl/nightly/cu128 -Pre
#>
[CmdletBinding()]
param(
    [string] $Root = 'D:\ai',
    [string] $TorchIndex = 'https://download.pytorch.org/whl/cu128',
    [switch] $Pre,
    [switch] $SkipClones
)

$ErrorActionPreference = 'Stop'

function Write-Step { param($Message) Write-Host "`n=== $Message" -ForegroundColor Cyan }
function Write-Ok   { param($Message) Write-Host "  [ok]   $Message" -ForegroundColor Green }
function Write-Warn { param($Message) Write-Host "  [warn] $Message" -ForegroundColor Yellow }
function Write-Skip { param($Message) Write-Host "  [skip] $Message" -ForegroundColor DarkGray }

function Test-Command { param($Name) $null -ne (Get-Command $Name -ErrorAction SilentlyContinue) }

$RepoRoot  = Split-Path -Parent $PSScriptRoot
$StudioDir = Join-Path $RepoRoot 'apps\studio'
$ComfyDir  = Join-Path $Root 'ComfyUI'
$FaceDir   = Join-Path $Root 'facefusion'
$DataDir   = Join-Path $Root 'studio-data'

Write-Step "Loom Studio bootstrap -> $Root"

# --- prerequisites ---------------------------------------------------------

Write-Step 'Checking prerequisites'

foreach ($tool in @('git', 'python')) {
    if (Test-Command $tool) { Write-Ok "$tool found" }
    else { throw "$tool is required but not on PATH. Install it, open a new shell, and re-run." }
}

$pythonVersion = (python -c "import sys; print('.'.join(map(str, sys.version_info[:2])))").Trim()
if ([version]$pythonVersion -lt [version]'3.11') {
    throw "Python $pythonVersion found; 3.11+ required."
}
Write-Ok "Python $pythonVersion"

# The Microsoft Store Python sandboxes filesystem access and breaks ComfyUI.
if ((python -c "import sys; print(sys.executable)") -match 'WindowsApps') {
    Write-Warn 'This looks like the Microsoft Store Python. Install from python.org instead — the Store build breaks ComfyUI path handling.'
}

if (Test-Command 'nvidia-smi') {
    $gpu = (nvidia-smi --query-gpu=name,memory.total --format=csv,noheader) -join '; '
    Write-Ok "GPU: $gpu"
} else {
    Write-Warn 'nvidia-smi not found — is the NVIDIA driver installed?'
}

# --- ffmpeg ----------------------------------------------------------------

Write-Step 'ffmpeg'
if (Test-Command 'ffmpeg') {
    Write-Skip 'already installed'
} elseif (Test-Command 'winget') {
    winget install --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements
    Write-Warn 'Open a NEW shell for ffmpeg to appear on PATH.'
} else {
    Write-Warn 'winget unavailable — install ffmpeg manually from https://www.gyan.dev/ffmpeg/builds/'
}

# --- clones ----------------------------------------------------------------

if (-not $SkipClones) {
    New-Item -ItemType Directory -Force -Path $Root | Out-Null

    Write-Step 'ComfyUI'
    if (Test-Path $ComfyDir) {
        Write-Skip "$ComfyDir exists"
    } else {
        git clone https://github.com/comfyanonymous/ComfyUI.git $ComfyDir
        Write-Ok 'cloned'
    }

    $managerDir = Join-Path $ComfyDir 'custom_nodes\ComfyUI-Manager'
    if (Test-Path $managerDir) {
        Write-Skip 'ComfyUI-Manager exists'
    } else {
        git clone https://github.com/ltdrdata/ComfyUI-Manager.git $managerDir
        Write-Ok 'ComfyUI-Manager cloned'
    }

    Write-Step 'FaceFusion'
    if (Test-Path $FaceDir) {
        Write-Skip "$FaceDir exists"
    } else {
        git clone https://github.com/facefusion/facefusion.git $FaceDir
        Write-Ok 'cloned (run its own installer: python install.py --onnxruntime cuda)'
    }
}

# --- ComfyUI python env ----------------------------------------------------

if (-not $SkipClones -and (Test-Path $ComfyDir)) {
    Write-Step 'ComfyUI environment (PyTorch for Blackwell)'
    $comfyVenv = Join-Path $ComfyDir '.venv'
    if (-not (Test-Path $comfyVenv)) { python -m venv $comfyVenv }
    $comfyPy = Join-Path $comfyVenv 'Scripts\python.exe'

    & $comfyPy -m pip install --upgrade pip --quiet

    # PyTorch FIRST, from the CUDA index. ComfyUI's requirements.txt lists a bare
    # `torch`, which pip would satisfy with a non-sm_120 wheel if installed first.
    $torchArgs = @('-m', 'pip', 'install', 'torch', 'torchvision', 'torchaudio', '--index-url', $TorchIndex)
    if ($Pre) { $torchArgs += '--pre' }
    Write-Host "  installing torch from $TorchIndex ..."
    & $comfyPy @torchArgs

    & $comfyPy -m pip install -r (Join-Path $ComfyDir 'requirements.txt')

    # Verify AFTER the requirements install, which is what usually clobbers it.
    Write-Step 'Verifying the GPU build'
    $probe = @'
import sys
import torch

print(f"torch      {torch.__version__}")
print(f"cuda build {torch.version.cuda}")
print(f"available  {torch.cuda.is_available()}")

if not torch.cuda.is_available():
    print("FAIL: torch cannot see the GPU")
    sys.exit(1)

major, minor = torch.cuda.get_device_capability(0)
arch = f"sm_{major}{minor}"
supported = torch.cuda.get_arch_list()
print(f"device     {torch.cuda.get_device_name(0)} ({arch})")
print(f"kernels    {' '.join(supported)}")

if arch not in supported:
    print(f"FAIL: this torch build has no {arch} kernels — wrong wheel for a Blackwell card")
    sys.exit(1)

print("OK: torch has kernels for this GPU")
'@
    $probe | & $comfyPy -
    if ($LASTEXITCODE -ne 0) {
        Write-Warn 'Torch cannot drive this GPU. Reinstall from the CUDA index (add -Pre for nightly) and see docs/studio/setup-windows-5070ti.md section 1.'
    } else {
        Write-Ok 'torch has kernels for this GPU'
    }
}

# --- studio ----------------------------------------------------------------

Write-Step 'Studio orchestrator'
$studioVenv = Join-Path $StudioDir '.venv'
if (-not (Test-Path $studioVenv)) { python -m venv $studioVenv }
$studioPy = Join-Path $studioVenv 'Scripts\python.exe'

& $studioPy -m pip install --upgrade pip --quiet
& $studioPy -m pip install -e "$StudioDir[dev]"
Write-Ok 'installed'

& $studioPy -m pytest (Join-Path $StudioDir 'tests') -q
Write-Ok 'tests pass'

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
[Environment]::SetEnvironmentVariable('STUDIO_DATA_DIR', $DataDir, 'User')
[Environment]::SetEnvironmentVariable('STUDIO_FACEFUSION_DIR', $FaceDir, 'User')
Write-Ok "STUDIO_DATA_DIR = $DataDir (set for your user; new shells pick it up)"

# --- next steps ------------------------------------------------------------

Write-Step 'Next steps'
@"
  1. Download models         -> docs/studio/model-matrix.md
                                Start with Wan 2.2 TI2V-5B into $ComfyDir\models\
  2. Start ComfyUI           -> cd $ComfyDir; .venv\Scripts\python.exe main.py
  3. Install FaceFusion deps -> cd $FaceDir; python install.py --onnxruntime cuda
  4. Start the studio        -> cd $StudioDir; .venv\Scripts\python.exe -m studio.main
  5. Open                    -> http://127.0.0.1:8710

  Verify everything at once: curl http://127.0.0.1:8710/api/health
"@ | Write-Host
