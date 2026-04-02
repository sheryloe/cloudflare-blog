param(
  [switch]$Remote,
  [string]$DatabaseName = "DB"
)

$seedFile = "seeds/demo-content.sql"
$arguments = @("d1", "execute", $DatabaseName)

if ($Remote) {
  $arguments += "--remote"
}
else {
  $arguments += "--local"
}

$arguments += "--file"
$arguments += $seedFile

Write-Host "Applying demo content seed from apps/api/$seedFile..."

Push-Location "apps/api"
try {
  corepack pnpm exec wrangler @arguments
}
finally {
  Pop-Location
}
