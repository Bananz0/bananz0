#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Create versioned snapshots of the site and commit them to the repository.
.DESCRIPTION
    Detects the latest git tag (e.g., v3), builds a static Jekyll site with
    baseurl /v3, and commits the snapshot into the repository.
.PARAMETER Tag
    Optional: specify a tag manually (e.g., "v3"). If omitted, the script
    detects the latest tag from `git describe --tags`.
.PARAMETER Push
    If present, automatically push the commit to origin/main.
.EXAMPLE
    # Detect latest tag and build snapshot
    pwsh tools/create-snapshot.ps1

    # Build snapshot for a specific tag
    pwsh tools/create-snapshot.ps1 -Tag v3

    # Build and push
    pwsh tools/create-snapshot.ps1 -Tag v3 -Push
#>

param(
    [string]$Tag,
    [switch]$Push
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

# Detect the tag if not provided
if (-not $Tag) {
    $Tag = & git describe --tags --abbrev=0 2>$null
    if (-not $Tag) {
        Write-Error "No git tags found. Create a tag first with: git tag v3"
        exit 1
    }
    Write-Host "Detected tag: $Tag"
}

# Validate tag format (e.g., v1, v2, v3)
if ($Tag -notmatch '^v\d+$') {
    Write-Error "Tag must be in the format vN (e.g., v1, v2, v3). Got: $Tag"
    exit 1
}

$version = $Tag
$snapshotDir = $version
$worktree = "tmp-$version"

# Clean up previous worktree if it exists
if (Test-Path $worktree) {
    try { & git worktree remove $worktree --force 2>$null } catch {}
    Remove-Item -LiteralPath $worktree -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`n==> Building snapshot for $Tag at tagged commit..." -ForegroundColor Cyan

# Get the commit hash for the tag
$commit = & git rev-parse "$Tag^{commit}" 2>$null
if (-not $commit) {
    Write-Error "Tag $Tag does not exist. Create it with: git tag $Tag"
    exit 1
}

Write-Host "Tagged commit: $commit"

# Add a worktree at the tagged commit
& git worktree add $worktree $commit
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create worktree for $Tag"
    exit 1
}

Push-Location $worktree
try {
    $dest = Join-Path (Resolve-Path ..).Path $snapshotDir
    Write-Host "`n==> Building Jekyll site with baseurl /$version into: $dest" -ForegroundColor Cyan
    
    if (Test-Path "Gemfile") {
        & bundle exec jekyll build --baseurl "/$version" -d $dest
    } else {
        & jekyll build --baseurl "/$version" -d $dest
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Jekyll build failed for $Tag"
        exit 1
    }
} finally {
    Pop-Location
}

# Clean up worktree
try {
    & git worktree remove $worktree --force 2>$null
} catch {
    Write-Warning "Could not remove worktree $worktree"
}

# Commit the snapshot
Write-Host "`n==> Committing snapshot $snapshotDir..." -ForegroundColor Cyan
& git add $snapshotDir
& git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "No changes to commit for $snapshotDir" -ForegroundColor Yellow
} else {
    & git commit -m "chore(site): add $version snapshot from $commit"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to commit $snapshotDir"
        exit 1
    }
    Write-Host "Committed $snapshotDir" -ForegroundColor Green
    
    if ($Push) {
        Write-Host "`n==> Pushing to origin/main..." -ForegroundColor Cyan
        & git push origin main
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to push to origin/main"
            exit 1
        }
        Write-Host "Pushed to origin/main" -ForegroundColor Green
    } else {
        Write-Host "`nSnapshot created. Run 'git push origin main' to deploy." -ForegroundColor Yellow
    }
}

Write-Host "`nDone! The site will be available at https://glenmuthoka.com/$version/" -ForegroundColor Green
