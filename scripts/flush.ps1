# `loom flush` — read-only system-flush reporter. Surfaces gaps (broken links,
# untested libs, fuzz crashes, dead refs); CHANGES NOTHING. Fixes are a separate,
# user-consented step (Rule 19). See scripts/lib/flush.mjs.
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Error "node not on PATH"; exit 2 }
Set-Location $root
& node (Join-Path $root "scripts/lib/flush.mjs") $root
exit $LASTEXITCODE
