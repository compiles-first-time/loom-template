# Loom credential collection — Windows / PowerShell.
#
# Per ADR-0036: collects platform PATs and other credentials via terminal
# stdin (NEVER through chat), validates them via read-only pre-flight calls
# (account-attestation closes Ravenwise Root cause 4), stores via
# @napi-rs/keyring, writes `keyring:<service>/<account>` references to
# .env.local. Falls back to literal .env.local storage if keyring is
# unavailable.
#
# Usage:
#   pwsh scripts/collect-credentials.ps1 <platform>
#   pwsh scripts/collect-credentials.ps1 supabase
#   pwsh scripts/collect-credentials.ps1 --rotate supabase   (re-prompt + overwrite)
#   pwsh scripts/collect-credentials.ps1 --list              (show stored credential names, no values)
#
# Sister script for POSIX shells: scripts/collect-credentials.sh

[CmdletBinding()]
param(
    [Parameter(Position=0)] [string]$Platform,
    [switch]$Rotate,
    [switch]$List,
    [switch]$Force,
    [switch]$NoKeyring   # forces .env.local literal storage even if keyring is available
)

$ErrorActionPreference = "Stop"
$repoRoot = (Get-Location).Path
$nodePath = if ($env:NODE_PATH) { $env:NODE_PATH } else { (Get-Command node -ErrorAction SilentlyContinue).Source }
if (-not $nodePath) {
    Write-Host "ERROR: node not found on PATH. Install Node 22+ first." -ForegroundColor Red
    exit 1
}

# ── Platform registry ───────────────────────────────────────────────────
# Each platform declares: credential vars to collect, their LR-04 categories,
# and the validation endpoint. Extending = add a hashtable entry.

$Platforms = @{
    supabase = @{
        Description  = "Supabase (Postgres + Auth + Storage)"
        Setup_url    = "https://supabase.com/dashboard/account/tokens"
        Setup_hint   = "Generate a Personal Access Token (PAT) at the URL above. Scope: leave default (full account)."
        Credentials  = @(
            @{
                EnvVar        = "SUPABASE_PAT"
                KeyringAccount= "supabase-pat"
                Prompt        = "Paste your Supabase PAT (input hidden)"
                Validate_url  = "https://api.supabase.com/v1/organizations"
                Validate_auth = "bearer"
                Account_field = "name"   # field in response to display for attestation
            }
        )
    }
    github = @{
        Description  = "GitHub (repos, issues, PRs)"
        Setup_url    = "https://github.com/settings/tokens"
        Setup_hint   = "Generate a Personal Access Token (classic OR fine-grained). Minimal scopes: repo, read:user."
        Credentials  = @(
            @{
                EnvVar        = "GITHUB_PERSONAL_ACCESS_TOKEN"
                KeyringAccount= "github-pat"
                Prompt        = "Paste your GitHub PAT (input hidden)"
                Validate_url  = "https://api.github.com/user"
                Validate_auth = "bearer"
                Account_field = "login"
            }
        )
    }
    vercel = @{
        Description  = "Vercel (deploys + env vars)"
        Setup_url    = "https://vercel.com/account/tokens"
        Setup_hint   = "Generate an access token. Scope: full access OR per-project."
        Credentials  = @(
            @{
                EnvVar        = "VERCEL_TOKEN"
                KeyringAccount= "vercel-token"
                Prompt        = "Paste your Vercel access token (input hidden)"
                Validate_url  = "https://api.vercel.com/v2/user"
                Validate_auth = "bearer"
                Account_field = "user.username"
            }
        )
    }
    anthropic = @{
        Description  = "Anthropic API (Claude)"
        Setup_url    = "https://console.anthropic.com/settings/keys"
        Setup_hint   = "Generate an API key. Scope: as needed for your project."
        Credentials  = @(
            @{
                EnvVar        = "ANTHROPIC_API_KEY"
                KeyringAccount= "anthropic-api-key"
                Prompt        = "Paste your Anthropic API key (input hidden)"
                Validate_url  = $null       # No public whoami endpoint; skip validation
                Validate_auth = $null
                Account_field = $null
            }
        )
    }
}

function Show-PlatformList {
    Write-Host ""
    Write-Host "Supported platforms (extend in scripts/collect-credentials.ps1):" -ForegroundColor Cyan
    foreach ($key in ($Platforms.Keys | Sort-Object)) {
        $p = $Platforms[$key]
        Write-Host ("  {0,-12} {1}" -f $key, $p.Description)
    }
    Write-Host ""
    Write-Host "Usage: pwsh scripts/collect-credentials.ps1 <platform>" -ForegroundColor DarkGray
}

if (-not $Platform -and -not $List) {
    Show-PlatformList
    exit 0
}

# ── Keyring availability check ──────────────────────────────────────────

function Test-KeyringAvailable {
    $probe = @"
import('file:///$($repoRoot.Replace('\','/'))/scripts/lib/keyring.mjs').then(async (m) => {
  const ok = await m.isKeyringAvailable();
  process.stdout.write(ok ? 'AVAILABLE' : 'UNAVAILABLE');
}).catch(() => process.stdout.write('UNAVAILABLE'));
"@
    $result = & $nodePath -e $probe 2>&1
    return ($result -eq "AVAILABLE")
}

$useKeyring = -not $NoKeyring
if ($useKeyring) {
    $available = Test-KeyringAvailable
    if (-not $available) {
        Write-Host ""
        Write-Host "OS keyring not available (or @napi-rs/keyring not installed)." -ForegroundColor Yellow
        Write-Host "  Install:  npm install --save-optional @napi-rs/keyring" -ForegroundColor DarkGray
        Write-Host "  Falling back to literal .env.local storage for this run." -ForegroundColor Yellow
        Write-Host ""
        $useKeyring = $false
    }
}

# ── --list mode ─────────────────────────────────────────────────────────

if ($List) {
    Write-Host ""
    if (-not $useKeyring) {
        Write-Host "Keyring unavailable; cannot list stored credentials." -ForegroundColor Yellow
        exit 1
    }
    $listProbe = @"
import('file:///$($repoRoot.Replace('\','/'))/scripts/lib/keyring.mjs').then(async (m) => {
  const svc = await m.getServiceKey('$($repoRoot.Replace('\','/').Replace("'", "\\'"))');
  process.stdout.write('SERVICE_KEY=' + svc);
});
"@
    $svc = & $nodePath -e $listProbe 2>&1
    Write-Host "Service key: $svc"
    Write-Host ""
    Write-Host "Stored credentials are listed via .env.local 'keyring:<service>/<account>' references." -ForegroundColor DarkGray
    if (Test-Path "$repoRoot/.env.local") {
        Get-Content "$repoRoot/.env.local" | Where-Object { $_ -match "keyring:" } | ForEach-Object {
            if ($_ -match "^([A-Z_]+)=keyring:") {
                Write-Host ("  - {0}" -f $matches[1])
            }
        }
    } else {
        Write-Host "  (no .env.local found)"
    }
    exit 0
}

# ── Platform lookup ─────────────────────────────────────────────────────

if (-not $Platforms.ContainsKey($Platform)) {
    Write-Host "ERROR: unknown platform '$Platform'" -ForegroundColor Red
    Show-PlatformList
    exit 1
}

$platformConfig = $Platforms[$Platform]
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  $($platformConfig.Description)" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Setup (one-time):" -ForegroundColor Yellow
Write-Host "  $($platformConfig.Setup_hint)"
Write-Host "  URL: $($platformConfig.Setup_url)" -ForegroundColor DarkGray
Write-Host ""

# Get the keyring service key for this project (if using keyring)
$serviceKey = $null
if ($useKeyring) {
    $svcProbe = @"
import('file:///$($repoRoot.Replace('\','/'))/scripts/lib/keyring.mjs').then(async (m) => {
  const svc = await m.getServiceKey('$($repoRoot.Replace('\','/').Replace("'", "\\'"))');
  process.stdout.write(svc);
});
"@
    $serviceKey = & $nodePath -e $svcProbe 2>&1
    Write-Host "Storage: OS keyring, service '$serviceKey'" -ForegroundColor Green
} else {
    Write-Host "Storage: literal .env.local (no keyring)" -ForegroundColor Yellow
}
Write-Host ""

# ── Collect each credential for the platform ───────────────────────────

foreach ($cred in $platformConfig.Credentials) {
    Write-Host ""
    Write-Host "→ $($cred.EnvVar)" -ForegroundColor Cyan

    # Check if already set; respect --force / --rotate
    $existingRef = $null
    if (Test-Path "$repoRoot/.env.local") {
        $line = (Get-Content "$repoRoot/.env.local") | Where-Object { $_ -match "^$($cred.EnvVar)=" } | Select-Object -First 1
        if ($line) {
            $existingRef = $line -replace "^$($cred.EnvVar)=", ""
            if ($existingRef -and -not $Rotate -and -not $Force) {
                Write-Host "  Already set in .env.local. Use --rotate to overwrite, --list to inspect." -ForegroundColor DarkGray
                continue
            }
        }
    }

    # Read the credential value from stdin (echo suppressed)
    $secure = Read-Host -Prompt "  $($cred.Prompt)" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $value = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    if (-not $value) {
        Write-Host "  ✗ No value entered; skipping." -ForegroundColor Red
        continue
    }

    # Validate (read-only pre-flight call) + account attestation
    $accountForAttestation = $null
    if ($cred.Validate_url) {
        Write-Host "  Validating credential via $($cred.Validate_url)..." -ForegroundColor DarkGray
        $headers = @{}
        if ($cred.Validate_auth -eq "bearer") {
            $headers["Authorization"] = "Bearer $value"
        }
        try {
            $resp = Invoke-RestMethod -Uri $cred.Validate_url -Headers $headers -Method GET -ErrorAction Stop
            # Extract the account field for attestation (supports dot-path like "user.username")
            $accountForAttestation = $resp
            foreach ($part in ($cred.Account_field -split "\.")) {
                $accountForAttestation = $accountForAttestation.$part
            }
            # If response was an array (e.g., Supabase /organizations returns [...])
            if ($accountForAttestation -is [System.Object[]] -and $accountForAttestation.Count -gt 0) {
                $first = $resp[0]
                foreach ($part in ($cred.Account_field -split "\.")) {
                    $first = $first.$part
                }
                $accountForAttestation = $first + " (and $($resp.Count - 1) other$([int]($resp.Count -gt 2) -ne 0 ? 's' : ''))"
            }
            Write-Host "  ✓ Credential is valid. Authenticated as: $accountForAttestation" -ForegroundColor Green
        } catch {
            Write-Host "  ✗ Validation failed: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "    The credential may be wrong, expired, or the platform may be unreachable." -ForegroundColor DarkGray
            $value = $null
            continue
        }
    } else {
        Write-Host "  (no validation endpoint configured for this credential — accepting as-is)" -ForegroundColor DarkGray
    }

    # Account attestation — closes Ravenwise Root cause 4
    if ($accountForAttestation) {
        Write-Host ""
        Write-Host "  ATTESTATION REQUIRED" -ForegroundColor Yellow
        Write-Host "  This credential is authenticated as: " -NoNewline; Write-Host $accountForAttestation -ForegroundColor Cyan
        Write-Host "  Is this the intended account for this project? [y/N] " -NoNewline -ForegroundColor Yellow
        $confirm = Read-Host
        if ($confirm -notmatch "^[Yy]") {
            Write-Host "  ✗ Attestation declined. Credential discarded." -ForegroundColor Red
            $value = $null
            continue
        }
    }

    # Store
    if ($useKeyring) {
        # Pipe value to a small Node script that writes via keyring.mjs.
        # Value never appears in command args — only on stdin.
        $writeScript = @"
import('file:///$($repoRoot.Replace('\','/'))/scripts/lib/keyring.mjs').then(async (m) => {
  let value = '';
  for await (const chunk of process.stdin) value += chunk;
  await m.setCredential('$serviceKey', '$($cred.KeyringAccount)', value.trimEnd());
  process.stdout.write('STORED');
});
"@
        $write = $value | & $nodePath -e $writeScript 2>&1
        if ($write -ne "STORED") {
            Write-Host "  ✗ Keyring write failed: $write" -ForegroundColor Red
            $value = $null
            continue
        }
        $envValue = "keyring:$serviceKey/$($cred.KeyringAccount)"
        Write-Host "  ✓ Stored in OS keyring; .env.local reference: $envValue" -ForegroundColor Green
    } else {
        $envValue = $value
        Write-Host "  ✓ Will write literal value to .env.local (no keyring)" -ForegroundColor Yellow
    }

    # Update .env.local
    $envFile = "$repoRoot/.env.local"
    if (-not (Test-Path $envFile)) {
        if (Test-Path "$repoRoot/.env.example") {
            Copy-Item "$repoRoot/.env.example" $envFile
        } else {
            New-Item -Path $envFile -ItemType File -Force | Out-Null
        }
    }
    $content = Get-Content $envFile -Raw
    if ($content -match "(?m)^$($cred.EnvVar)=.*$") {
        $newContent = $content -replace "(?m)^$($cred.EnvVar)=.*$", "$($cred.EnvVar)=$envValue"
    } else {
        $newContent = $content.TrimEnd() + "`n$($cred.EnvVar)=$envValue`n"
    }
    Set-Content -Path $envFile -Value $newContent -NoNewline -Encoding utf8

    # Scrub local copy
    $value = $null
}

Write-Host ""
Write-Host "Done. .env.local updated for platform '$Platform'." -ForegroundColor Green
Write-Host "Run again with --rotate to refresh a credential." -ForegroundColor DarkGray
