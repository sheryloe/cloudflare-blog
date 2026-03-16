param(
  [string]$AdminEmail
)

$ErrorActionPreference = "Stop"

if (-not $AdminEmail) {
  do {
    $AdminEmail = Read-Host "Admin email (example: admin@example.com)"
  } while ([string]::IsNullOrWhiteSpace($AdminEmail))
}

if ([string]::IsNullOrWhiteSpace($AdminEmail)) {
  throw "Admin email is required."
}

$securePassword = Read-Host "Admin password" -AsSecureString
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if ([string]::IsNullOrEmpty($plainPassword)) {
  throw "Admin password is required."
}

$sha256 = [System.Security.Cryptography.SHA256]::Create()

try {
  $passwordHashBytes = $sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($plainPassword))
} finally {
  $sha256.Dispose()
}

$passwordHash = -join ($passwordHashBytes | ForEach-Object { $_.ToString("x2") })

$jwtBytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()

try {
  $rng.GetBytes($jwtBytes)
} finally {
  $rng.Dispose()
}

$jwtSecret = -join ($jwtBytes | ForEach-Object { $_.ToString("x2") })

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Push-Location $repoRoot

try {
  $AdminEmail | corepack pnpm --filter @donggeuri/api exec wrangler secret put ADMIN_EMAIL
  $passwordHash | corepack pnpm --filter @donggeuri/api exec wrangler secret put ADMIN_PASSWORD_HASH
  $jwtSecret | corepack pnpm --filter @donggeuri/api exec wrangler secret put JWT_SECRET
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Worker secrets updated."
Write-Host "Next step: corepack pnpm --filter @donggeuri/api exec wrangler deploy"
