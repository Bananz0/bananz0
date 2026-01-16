# Site Versioning & Deployment

This repository uses tagged snapshots to maintain historical versions of the site.

## How Versioning Works

- **Current site (root)**: The latest version served at `https://glenmuthoka.com/`
- **Archived snapshots**: Versioned static builds served at `https://glenmuthoka.com/vN/`
  - `v1/` → Site as of commit `53b0db5` (initial release)
  - `v2/` → (current: not yet snapshotted, served at root)
  - `v3/` → (future snapshot)

## Creating a New Snapshot

When you're ready to archive the current site and start a new version:

### 1. Tag the current commit

```powershell
# Tag the commit you want to snapshot (usually the current HEAD)
git tag v3
git push origin v3
```

### 2. Run the snapshot script

```powershell
# Auto-detect latest tag and build snapshot
pwsh tools/create-snapshot.ps1

# Or specify a tag manually
pwsh tools/create-snapshot.ps1 -Tag v3

# Build and push in one step
pwsh tools/create-snapshot.ps1 -Tag v3 -Push
```

### 3. Push the snapshot (if you didn't use `-Push`)

```powershell
git push origin main
```

## What the Script Does

1. Detects (or uses) the specified git tag (e.g., `v3`)
2. Checks out that tagged commit in a temporary worktree
3. Builds the Jekyll site with `--baseurl /v3`
4. Commits the built `v3/` folder into `main`
5. Optionally pushes to `origin/main`

## Workflow

```
┌─────────────────────────────────────────────────────────┐
│  Current site at root (glenmuthoka.com)                 │
│  - Active development                                    │
│  - Latest features and fixes                             │
└─────────────────────────────────────────────────────────┘
                        │
                        │ Ready to archive?
                        ▼
                   git tag v3
                        │
                        ▼
          pwsh tools/create-snapshot.ps1 -Tag v3 -Push
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  v3/ folder committed to main                            │
│  - Static snapshot of tagged commit                      │
│  - Served at glenmuthoka.com/v3/                        │
└─────────────────────────────────────────────────────────┘
                        │
                        │ Continue development
                        ▼
         Root becomes "v4 (unreleased)"
```

## GitHub Actions

The `.github/workflows/jekyll.yml` workflow builds and deploys the site automatically on push to `main`. It now uses Ruby 3.2 to satisfy Bundler 4.0.4 requirements.

## Manual Snapshot Creation (Alternative)

If you prefer to build snapshots manually:

```powershell
# Check out the tag in a worktree
git worktree add tmp-v3 v3

# Build with baseurl
cd tmp-v3
bundle exec jekyll build --baseurl /v3 -d ../v3

# Clean up and commit
cd ..
git worktree remove tmp-v3 --force
git add v3
git commit -m "chore(site): add v3 snapshot"
git push origin main
```

## Tips

- **Always tag before snapshotting**: Tags ensure you can rebuild exact snapshots later.
- **Commit frequently**: The root site is always the latest; tag when you want to preserve a milestone.
- **Test locally first**: Build with `bundle exec jekyll serve --baseurl /vN` to preview.
- **Keep snapshots static**: Don't edit files inside `vN/` folders directly; rebuild from tags if needed.
