param(
  [switch]$Remote,
  [string]$DatabaseName = "DB"
)

$seedFile = "seeds/prune-legacy-content.sql"
$arguments = @("d1", "execute", $DatabaseName)

if ($Remote) {
  $arguments += "--remote"
}
else {
  $arguments += "--local"
}

$arguments += "--file"
$arguments += $seedFile

Write-Host "Pruning legacy demo/test content from apps/api/$seedFile..."

Push-Location "apps/api"
try {
  corepack pnpm exec wrangler @arguments
}
finally {
  Pop-Location
}
