# `loom update-bus tick` — PowerShell wrapper around the Node stub.
# v0.3 receiver (ADR-0057): validates inbox items against schema.json + surfaces
# the Critic queue. Never applies/merges. Feed polling = the research-scout agent.

param(
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Rest
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$runner = Join-Path $root "scripts/lib/update-bus-tick.mjs"

if (-not (Test-Path $runner)) {
    Write-Error "$runner not found"
    exit 2
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "node not on PATH (Loom v0.2 requires Node 22+)"
    exit 2
}

Set-Location $root
if ($Rest) {
    & node $runner @Rest
} else {
    & node $runner
}
exit $LASTEXITCODE
