---
layout: project
title: Galaxy Book Enabler
category: WINDOWS
tagline: Unlock Samsung's ecosystem on any Windows PC with authentic hardware spoofing
description: Professional PowerShell tool enabling Samsung Galaxy Book features on non-Samsung devices
github_url: https://github.com/Bananz0/GalaxyBookEnabler
tech_stack:
  - PowerShell 7
  - Registry Manipulation
  - WinGet
  - Task Scheduler
  - BIOS/DMI Spoofing
stats:
  - value: "2.2K+"
    label: Downloads
  - value: "21"
    label: Device Models
  - value: "30+"
    label: App Packages
quick_facts:
  - icon: "🎯"
    text: "Spoofs 11 BIOS/DMI registry values for authentic device identity"
  - icon: "⚡"
    text: "Auto-elevation with gsudo and Windows 11 native sudo support"
  - icon: "📦"
    text: "Smart package management with Intel Wi-Fi compatibility detection"
  - icon: "🔄"
    text: "Daily auto-update checks with seamless version migration"
  - icon: "🖥️"
    text: "System Support Engine for Windows 11 advanced integration"
links:
  - text: "GitHub Repository"
    url: "https://github.com/Bananz0/GalaxyBookEnabler"
  - text: "Latest Release"
    url: "https://github.com/Bananz0/GalaxyBookEnabler/releases/latest"
  - text: "Report Issue"
    url: "https://github.com/Bananz0/GalaxyBookEnabler/issues"
related_projects:
  - title: "eGPU Auto-Enabler"
    category: "eGPU"
    description: "Automated external GPU management for Windows"
    url: "/projects/egpu-auto-enabler"
  - title: "WinStream"
    category: "WINDOWS"
    description: "AirPlay audio bridge for Windows systems"
    url: "/projects"
---

## Overview

Galaxy Book Enabler is a sophisticated PowerShell automation tool that transforms any Windows PC into a Samsung Galaxy Book, unlocking access to Samsung's exclusive ecosystem including **Quick Share**, **Multi Control**, **Samsung Notes**, and 20+ other applications.

Unlike simple registry hacks, this tool implements **authentic hardware spoofing** using real BIOS/DMI values extracted from 21 different Galaxy Book models spanning the Book3, Book4, and Book5 generations.

## The Problem

Samsung's ecosystem apps perform deep hardware validation checks, examining multiple BIOS and DMI registry values to confirm device authenticity. Simple spoofing attempts fail because:

1. **Incomplete spoofing** - Most solutions only modify 1-2 values
2. **Incorrect BIOS versions** - Using fake/incorrect version strings triggers detection
3. **Missing System Support** - Advanced features require Samsung's support service
4. **Poor UX** - Manual registry editing is error-prone and doesn't persist

## The Solution

<div class="feature-highlight">
<h4>Complete Hardware Identity Spoofing</h4>

Galaxy Book Enabler spoofs **all 11 critical BIOS/DMI values**:
- BIOS Vendor, Version, Major/Minor Release
- Base Board Manufacturer & Product
- System Product Name, Family, Manufacturer
- Product SKU & Enclosure Kind

All values are extracted from **real Samsung Galaxy Book hardware**, ensuring perfect compatibility.
</div>

### Key Features

#### 1. Interactive Model Selection
Choose from 21 authentic Galaxy Book profiles:
- **Galaxy Book5** (2025): 960XHA, 940XHA, 960QHA, 750QHA
- **Galaxy Book4** (2024): 960XGL, 960XGK, 940XGK, 750XGK, 750XGL, 750QGK
- **Galaxy Book3** (2023): 960XFH, 960XFG, 960QFG, 750XFG, 750XFH, 730QFG
- **Legacy Models**: Book2 Pro Special Edition, older Book/Notebook series

Each model includes authentic:
- BIOS version strings (e.g., `P08ALX.400.250306.05`)
- Product identifiers
- OEM manufacturer strings
- Board revision codes

#### 2. Smart Package Management

Four installation profiles:
- **Core Only** - Essential services (7 packages)
- **Recommended** - All working apps (16 packages) ⭐
- **Full Experience** - Includes experimental features (20 packages)
- **Everything** - All packages including non-functional (22 packages)

<div class="warning-block">
<h4>Intel Wi-Fi Requirement</h4>

**Quick Share** requires Intel Wi-Fi adapters for full functionality. The installer automatically detects your adapter and warns if compatibility issues exist. Non-Intel users should consider **Google Nearby Share** as an alternative.
</div>

#### 3. System Support Engine (Advanced)

Experimental Windows 11 feature that installs Samsung's official system support service:
- Downloads official CAB from Microsoft Update Catalog
- Patches binary executable for non-Samsung hardware
- Installs as Windows service (`GBeSupportService`)
- Enables advanced Samsung Settings features
- Auto-installs driver via pnputil

<div class="warning-block">
<h4>Advanced Users Only</h4>

System Support Engine involves binary patching and may trigger antivirus warnings. Only enable if you understand the implications and are prepared to troubleshoot.
</div>

## Technical Architecture

### Registry Spoof Mechanism

```powershell
# Core spoofing logic (simplified)
$registryPath = "HKLM:\HARDWARE\DESCRIPTION\System\BIOS"
$values = @{
    "BIOSVendor" = "Samsung Electronics Co., Ltd."
    "BIOSVersion" = "P08ALX.400.250306.05"
    "SystemProductName" = "960XGL"
    "SystemFamily" = "GalaxyBook4"
    # ... 7 more values
}

foreach ($key in $values.Keys) {
    Set-ItemProperty -Path $registryPath -Name $key -Value $values[$key]
}
```

### Startup Persistence

Creates scheduled task `GalaxyBookEnabler` that:
- Runs at system startup (10-second delay)
- Uses SYSTEM privileges for registry access
- Re-applies spoof after every reboot
- Runs hidden in background

### Package Installation

Leverages **WinGet** for app installation:
```powershell
winget install --id 9MSSFZ1P68WC --accept-package-agreements --accept-source-agreements
```

All package IDs are Microsoft Store identifiers, ensuring official app sources.

## Performance Metrics

<div class="achievement-block">
<h4>Real-World Results</h4>

- **2,200+ successful installations** across diverse hardware
- **Zero reported security incidents** (no malware, no data loss)
- **95%+ compatibility rate** with supported Windows versions
- **<5 minute** average installation time
- **24-48 hour** average issue response time
</div>

## Installation

### One-Line Install
```powershell
irm https://raw.githubusercontent.com/Bananz0/GalaxyBookEnabler/main/Install-GalaxyBookEnabler.ps1 | iex
```

### With Auto-Elevation (Recommended)
```powershell
# Install gsudo first
winget install gerardog.gsudo

# Then install with automatic admin elevation
irm https://raw.githubusercontent.com/Bananz0/GalaxyBookEnabler/main/Install-GalaxyBookEnabler.ps1 | gsudo pwsh
```

### Post-Installation
1. Reboot your system
2. Sign into Samsung Account
3. Launch Galaxy Book Experience
4. Configure Samsung apps

## Compatibility Matrix

| Package | Intel Wi-Fi Required | Status |
|---------|---------------------|--------|
| Quick Share | **Yes** | ✅ Working |
| Multi Control | No | ✅ Working |
| Samsung Notes | No | ✅ Working |
| Samsung Flow | No | ✅ Working |
| Galaxy Buds Manager | No | ✅ Working |
| Samsung Settings | No | ✅ Working |
| Samsung Recovery | N/A | ❌ Not Working |
| Samsung Update | N/A | ❌ Not Working |

## Known Limitations

- **Quick Share** limited on non-Intel Wi-Fi
- **System Support Engine** Windows 11 only, experimental
- **Samsung Recovery/Update** will never work (requires genuine hardware)
- **Registry spoof** volatile, resets on reboot (handled by scheduled task)

## Future Roadmap

- [ ] Windows 10 support for System Support Engine
- [ ] Multi-eGPU support detection
- [ ] Custom BIOS value editor GUI
- [ ] Auto-backup/restore configuration
- [ ] PowerShell Gallery publication

## Credits

Originally by [@obrobrio2000](https://github.com/obrobrio2000), enhanced and maintained by [@Bananz0](https://github.com/Bananz0).

---

**Disclaimer**: This tool is for educational purposes. Not affiliated with Samsung Electronics. Use at your own risk.