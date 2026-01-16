param(
    [switch]$Commit
)

Set-StrictMode -Version Latest
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Push-Location "$scriptDir\.."

# Find existing vN directories and select next version
$existing = Get-ChildItem -Directory -Name 2>$null | Where-Object { $_ -match '^v\d+$' }
if ($existing) {
    $nums = $existing | ForEach-Object { [int]($_ -replace '^v', '') }
    $max = ($nums | Measure-Object -Maximum).Maximum
    $next = $max + 1
} else {
    $next = 1
}

$outDir = "v$next"
$baseurl = "/v$next"

Write-Host "Building Jekyll site into ./$outDir with baseurl '$baseurl'..."

if (Test-Path "Gemfile") {
    & bundle exec jekyll build --baseurl $baseurl -d $outDir
} else {
    & jekyll build --baseurl $baseurl -d $outDir
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "Jekyll build failed with exit code $LASTEXITCODE"
    Pop-Location
    exit $LASTEXITCODE
}

Write-Host "Built into ./$outDir."

if ($Commit) {
    git add $outDir
    git commit -m "chore(site): add $outDir static snapshot"
    git push
    Write-Host "Committed and pushed ./$outDir"
}

Write-Host "Tip: Preview locally with: `bundle exec jekyll serve --baseurl $baseurl --watch` or push to GitHub and open https://<your-user>.github.io/<repo>/$outDir/"

Pop-Location
