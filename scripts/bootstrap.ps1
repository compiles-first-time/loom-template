# Loom v0.1 manual bootstrap helper (PowerShell)
#
# At v0.1 the bootstrap is manual. This script performs the deterministic steps
# (placeholder substitution, smoke checks) but leaves agent decisions to you.
#
# Usage:
#   .\scripts\bootstrap.ps1 -ProjectName "my-new-project" -Description "..." -UserName "Nick"

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectName,

    [Parameter(Mandatory=$false)]
    [string]$Description = "",

    [Parameter(Mandatory=$false)]
    [string]$UserName = $env:USERNAME
)

$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
Write-Host "Loom v0.1 bootstrap" -ForegroundColor Cyan
Write-Host "  Project: $ProjectName"
Write-Host "  Root:    $root"
Write-Host ""

# --- 1. Placeholder substitution -------------------------------------------------
$placeholderFiles = @(
    "README.md",
    "CLAUDE.md",
    "AGENTS.md",
    "loom-spec.md",
    "constitution/kernel-v6.md",
    "constitution/local-rules.md",
    "memory/self-knowledge.md",
    "tools/mcp-servers/config.yaml",
    "observability/langfuse-config.yaml"
)

$replacements = @{
    "<PROJECT_NAME>" = $ProjectName
    "<USER_NAME>"    = $UserName
    "<YYYY-MM-DD>"   = (Get-Date -Format "yyyy-MM-dd")
}

foreach ($rel in $placeholderFiles) {
    $path = Join-Path $root $rel
    if (-not (Test-Path $path)) {
        Write-Host "  skip (missing): $rel" -ForegroundColor DarkGray
        continue
    }
    $content = Get-Content $path -Raw -Encoding UTF8
    $changed = $false
    foreach ($key in $replacements.Keys) {
        if ($content -match [regex]::Escape($key)) {
            $content = $content -replace [regex]::Escape($key), $replacements[$key]
            $changed = $true
        }
    }
    if ($changed) {
        Set-Content -Path $path -Value $content -Encoding UTF8 -NoNewline
        Write-Host "  stamped: $rel" -ForegroundColor Green
    }
}

# --- 2. Smoke checks -------------------------------------------------------------
Write-Host ""
Write-Host "Running smoke checks..." -ForegroundColor Cyan

$failures = @()

$requiredDirs = @(
    "constitution", "layers", "agents/hr", "agents/eac", "agents/human-replica",
    "agents/critic", "agents/memory-keeper", "agents/constitution-service",
    "memory/event-log", "memory/skills", "tools/mcp-servers",
    "orchestration", "observability/eval-suite", "adr", "lessons-learned",
    "update-bus/inbox", "update-bus/archive", "spec"
)
foreach ($d in $requiredDirs) {
    if (-not (Test-Path (Join-Path $root $d))) {
        $failures += "missing directory: $d"
    }
}

$requiredFiles = @(
    "README.md", "CLAUDE.md", "AGENTS.md", "loom-spec.md", "LICENSE",
    ".gitignore", ".env.example",
    "constitution/kernel-v6.md", "constitution/local-rules.md",
    "spec/loom-spec-v0.1-full.md",
    "tools/mcp-servers/config.yaml",
    "observability/langfuse-config.yaml",
    "adr/0000-template.md", "adr/0001-loom-version.md", "adr/0002-orchestration-framework.md"
)
foreach ($f in $requiredFiles) {
    if (-not (Test-Path (Join-Path $root $f))) {
        $failures += "missing file: $f"
    }
}

# Size discipline
$claudeMd = Get-Item (Join-Path $root "CLAUDE.md") -ErrorAction SilentlyContinue
if ($claudeMd -and $claudeMd.Length -gt 10KB) {
    $failures += "CLAUDE.md exceeds 10 KB cap ($([int]($claudeMd.Length/1KB)) KB)"
}
$agentsMd = Get-Item (Join-Path $root "AGENTS.md") -ErrorAction SilentlyContinue
if ($agentsMd -and $agentsMd.Length -gt 5KB) {
    $failures += "AGENTS.md exceeds 5 KB cap ($([int]($agentsMd.Length/1KB)) KB)"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "Smoke checks FAILED:" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}

Write-Host "  All smoke checks passed." -ForegroundColor Green

# --- 3. v0.2 runtime stamping ----------------------------------------------------
Write-Host ""
Write-Host "Generating v0.2 runtime artifacts..." -ForegroundColor Cyan

# Touch today's JSONL so hooks have somewhere to write
$dateLog = Join-Path $root "memory/event-log/$(Get-Date -AsUTC -Format 'yyyy-MM-dd').jsonl"
if (-not (Test-Path $dateLog)) {
    New-Item -ItemType File -Path $dateLog -Force | Out-Null
    Write-Host "  created: memory/event-log/$(Split-Path $dateLog -Leaf)"
} else {
    Write-Host "  exists:  memory/event-log/$(Split-Path $dateLog -Leaf)" -ForegroundColor DarkGray
}

# Regenerate .claude/settings.json mcpServers block from the YAML
$gen = Join-Path $root "scripts/lib/mcp-yaml-to-settings.mjs"
if ((Test-Path $gen) -and (Get-Command node -ErrorAction SilentlyContinue)) {
    try {
        & node $gen | ForEach-Object { Write-Host "  $_" }
    } catch {
        Write-Host "  warn: mcp settings generation failed (continuing)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  skip: node or generator not available; .claude/settings.json mcpServers not regenerated" -ForegroundColor DarkGray
}

# --- 4. Summary ------------------------------------------------------------------
$subagentCount = (Get-ChildItem -Path (Join-Path $root ".claude/agents") -Filter "*.md" -ErrorAction SilentlyContinue | Measure-Object).Count
$hookCount = (Get-ChildItem -Path (Join-Path $root "scripts/hooks") -Filter "*.mjs" -ErrorAction SilentlyContinue | Measure-Object).Count

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Bootstrap complete - Loom v0.2.0 | Kernel v6" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Project:     $ProjectName"
Write-Host "  Root:        $root"
Write-Host "  Stamped:     $($placeholderFiles.Count) files"
Write-Host "  Event log:   memory/event-log/$(Split-Path $dateLog -Leaf)"
Write-Host "  Subagents:   $subagentCount at .claude/agents/"
Write-Host "  Hooks:       $hookCount at scripts/hooks/"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Install your canonical Trajectory Kernel V6 text into constitution/kernel-v6.md"
Write-Host "  2. Edit CLAUDE.md to describe this project's specific goals"
Write-Host "  3. Decide full-6 vs minimal-3 agent set (see layers/L2-agents.md)"
Write-Host "  4. Copy .env.example to .env and fill in API keys"
Write-Host "  5. Confirm or override ADR-0002 (orchestration framework)"
Write-Host "  6. git init; git add .; git commit -m 'Loom v0.2 scaffold'"
Write-Host ""
Write-Host "Run scripts/doctor.ps1 (PR-5) to validate the project at any time."
