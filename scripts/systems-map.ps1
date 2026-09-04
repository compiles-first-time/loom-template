# loom systems-map - the systems atlas (ADR-0065): validate the registry, answer
# impact questions (affects / affected-by / impact), render ATLAS.md + explorer.
#   scripts/systems-map.ps1 validate
#   scripts/systems-map.ps1 impact <system_id>
#   scripts/systems-map.ps1 render [--check]
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  & node (Join-Path $root "scripts/lib/systems-map.mjs") @args
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
