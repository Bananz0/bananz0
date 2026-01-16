param(
  [string]$User = "Bananz0",
  [string]$OutFile = "$PSScriptRoot\..\_data\github_repos.json",
  [int]$PerPage = 100,
  [string]$Token = $env:GITHUB_TOKEN
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

  $headers = @{ "Accept" = "application/vnd.github+json" }
  if ($Token) { $headers["Authorization"] = "token $Token" }

  $maxRetries = 4
  $delay = 2
  for ($i = 0; $i -lt $maxRetries; $i++) {
    try {
      return Invoke-RestMethod -Uri $Url -Headers $headers -ErrorAction Stop
    }
    catch {
      $status = $null
      if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
        $status = [int]$_.Exception.Response.StatusCode.value__
      }

      # If rate limited (403) and header X-RateLimit-Reset is present, sleep until reset
      try {
        $reset = $_.Exception.Response.Headers['X-RateLimit-Reset']
      } catch { $reset = $null }
      if ($status -eq 403 -and $reset) {
        $resetEpoch = [int]$reset
        $waitSec = [int]($resetEpoch - [int](Get-Date -UFormat %s)) + 5
        if ($waitSec -gt 0) {
          Write-Host "Rate limited. Sleeping for $waitSec seconds..." -ForegroundColor Yellow
          Start-Sleep -Seconds $waitSec
          continue
        }
      }

      if ($i -lt ($maxRetries - 1)) {
        Write-Host "API request failed (attempt $($i+1)/$maxRetries). Retrying in ${delay}s..." -ForegroundColor Yellow
        Start-Sleep -Seconds $delay
        $delay = [math]::Min($delay * 2, 30)
        continue
      }

      throw $_
    }
  }
}

function Get-ReleaseDownloadCount {
  param([string]$Owner, [string]$RepoName)

  # Reduce requests by fetching only latest few releases (per_page=3)
  $releasesUrl = "https://api.github.com/repos/$Owner/$RepoName/releases?per_page=3"
  try {
    $releases = Invoke-GitHubApi -Url $releasesUrl
    if ($releases -and $releases.Count -gt 0) {
      $totalDownloads = 0
      foreach ($release in $releases) {
        if ($release.assets) {
          foreach ($asset in $release.assets) {
            $totalDownloads += ($asset.download_count -as [int])
          }
        }
      }
      return $totalDownloads
    }
    return 0
  }
  catch {
    Write-Host "  Warning: Could not fetch release stats for $RepoName" -ForegroundColor Yellow
    return 0
  }
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

# Weights for combined score: tune as needed
$weightDownloads = 1
$weightStars = 150
$weightForks = 50

# Normalize into a smaller, stable schema for Jekyll and compute a combined `score`
$normalized = $filtered | ForEach-Object {
  $repoName = $_.name
  $repoKey = $repoName.ToLowerInvariant()

  # Fetch download count for releases
  Write-Host "Processing: $repoName" -NoNewline
  $downloadCount = Get-ReleaseDownloadCount -Owner $User -RepoName $repoName
  if ($downloadCount -gt 0) {
    Write-Host " ($downloadCount downloads)" -ForegroundColor Green
  } else {
    Write-Host ""
  }

  $stars = 0
  if ($_.stargazers_count) { $stars = $_.stargazers_count }
  $forks = 0
  if ($_.forks_count) { $forks = $_.forks_count }

  $score = ($downloadCount * $weightDownloads) + ($stars * $weightStars) + ($forks * $weightForks)

  [pscustomobject]@{
    name = $_.name
    full_name = $_.full_name
    html_url = $_.html_url
    description = $_.description
    language = $_.language
    fork = $_.fork
    hidden = $HiddenRepoLookup.ContainsKey($repoKey)
    stargazers_count = $stars
    forks_count = $forks
    open_issues_count = $_.open_issues_count
    download_count = $downloadCount
    score = $score
    pushed_at = $_.pushed_at
    created_at = $_.created_at
    topics = @($_.topics)
  }
} | Sort-Object -Property score -Descending

$targetDir = Split-Path -Parent $OutFile
if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir | Out-Null }

$normalized | ConvertTo-Json -Depth 6 | Out-File -FilePath $OutFile -Encoding utf8

Write-Host "Wrote $($normalized.Count) repos to $OutFile"