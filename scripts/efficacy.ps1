# loom efficacy - ADR-0054 Phase-1a governed-vs-ungoverned safety-catch measurement.
$root = Split-Path -Parent $PSScriptRoot
& node (Join-Path $root "observability/eval-suite/efficacy/harness.mjs") @args
exit $LASTEXITCODE
