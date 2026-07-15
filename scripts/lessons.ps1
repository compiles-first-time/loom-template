# loom lessons - Phase 0 (ADR-0055): search local lessons + validate their schema.
#   scripts/lessons.ps1 search "<query>" [--domain d --stack s --platform p]
#   scripts/lessons.ps1 validate
$root = Split-Path -Parent $PSScriptRoot
& node (Join-Path $root "scripts/lib/lessons.mjs") @args
exit $LASTEXITCODE
