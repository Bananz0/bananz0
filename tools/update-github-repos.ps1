param(
  [string]$User = "Bananz0",
  [string]$OutFile = "$PSScriptRoot\..\_data\github_repos.json",
  [int]$PerPage = 100
)

$ErrorActionPreference = "Stop"

# Manual hide list (kept in the JSON as `hidden: true` so the site can filter)
$HiddenRepoNames = @(
  "bananz0",
  "p4",
  "mag-air"
)
$HiddenRepoLookup = @{}
foreach ($n in $HiddenRepoNames) { $HiddenRepoLookup[$n.ToLowerInvariant()] = $true }

function Invoke-GitHubApi {
  param([string]$Url)
  Invoke-RestMethod -Uri $Url -Headers @{ "Accept" = "application/vnd.github+json" }
}

$all = @()
$page = 1

while ($true) {
  $url = "https://api.github.com/users/$User/repos?per_page=$PerPage&page=$page&sort=pushed"
  $repos = Invoke-GitHubApi -Url $url
  if (-not $repos -or $repos.Count -eq 0) { break }
  $all += $repos
  if ($repos.Count -lt $PerPage) { break }
  $page++
}

# Heuristic filter for "public ones that I already have committed to":
# - Keep non-forks (owned work)
# - For forks, keep only if they look actively pushed after creation (suggesting local contributions)
$filtered = $all | Where-Object {
  $_.private -eq $false -and $_.archived -eq $false -and (
    $_.fork -eq $false -or (
      $_.fork -eq $true -and $_.pushed_at -and $_.created_at -and
      ([DateTime]$_.pushed_at - [DateTime]$_.created_at).TotalHours -ge 6
    )
  )
}

# Normalize into a smaller, stable schema for Jekyll
$normalized = $filtered | ForEach-Object {
  $repoName = $_.name
  $repoKey = $repoName.ToLowerInvariant()
  [pscustomobject]@{
    name = $_.name
    full_name = $_.full_name
    html_url = $_.html_url
    description = $_.description
    language = $_.language
    fork = $_.fork
    hidden = $HiddenRepoLookup.ContainsKey($repoKey)
    stargazers_count = $_.stargazers_count
    forks_count = $_.forks_count
    open_issues_count = $_.open_issues_count
    pushed_at = $_.pushed_at
    created_at = $_.created_at
    topics = @($_.topics)
  }
} | Sort-Object -Property pushed_at -Descending

$targetDir = Split-Path -Parent $OutFile
if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir | Out-Null }

$normalized | ConvertTo-Json -Depth 6 | Out-File -FilePath $OutFile -Encoding utf8

Write-Host "Wrote $($normalized.Count) repos to $OutFile"