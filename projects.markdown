---
layout: default
title: Projects
---

<section>
  <div class="section-header">
    <h2>My Projects</h2>
  </div>

  <div class="projects-grid">
    <div class="project-card">
      <div class="project-img" style="background-color: #3498db;"></div>
      <div class="project-content">
        <h3>ControlCraft</h3>
        <p>A MATLAB-based GUI tool for learning and experimenting with control system concepts. Makes control system analysis intuitive and interactive.</p>
        <a href="https://github.com/Bananz0/ControlCraft" class="btn" target="_blank" rel="noopener noreferrer">View Project <i class="fas fa-arrow-right"></i></a>
      </div>
    </div>
    
    <div class="project-card">
      <div class="project-img" style="background-color: #2ecc71;"></div>
      <div class="project-content">
        <h3>SmartSync-Lighting</h3>
        <p>Innovative project that synchronizes your smart home lighting with music, creating an immersive audiovisual experience.</p>
        <a href="https://github.com/Bananz0/SmartSync-Lighting" class="btn" target="_blank" rel="noopener noreferrer">View Project <i class="fas fa-arrow-right"></i></a>
      </div>
    </div>
    
    <div class="project-card">
      <div class="project-img" style="background-color: #e74c3c;"></div>
      <div class="project-content">
        <h3>PiBoard</h3>
        <p>A whiteboard chat application for the Raspberry Pi that allows users to draw on a canvas and share their drawings in real-time.</p>
        <a href="https://github.com/Bananz0/PiBoard" class="btn" target="_blank" rel="noopener noreferrer">View Project <i class="fas fa-arrow-right"></i></a>
      </div>
    </div>
    
    <div class="project-card">
      <div class="project-img" style="background-color: #9b59b6;"></div>
      <div class="project-content">
        <h3>Somnus</h3>
        <p>Your personal wake-up companion, designed to optimize your wake-up routine and ensure you start your day feeling refreshed.</p>
        <a href="https://github.com/Bananz0/SmartSync-Lighting" class="btn" target="_blank" rel="noopener noreferrer">View Project <i class="fas fa-arrow-right"></i></a>
      </div>
    </div>
    
    <div class="project-card">
      <div class="project-img" style="background-color: #f1c40f;"></div>
      <div class="project-content">
        <h3>WinStream</h3>
        <p>Stream audio seamlessly from your Windows PC to a wide range of AirPlay-compatible devices.</p>
        <a href="https://github.com/Bananz0/WinStream" class="btn" target="_blank" rel="noopener noreferrer">View Project <i class="fas fa-arrow-right"></i></a>
      </div>
    </div>
    
    <div class="project-card">
      <div class="project-img" style="background-color: #34495e;"></div>
      <div class="project-content">
        <h3>IC Design & Fabrication</h3>
        <p>TSMC 65nm Node Integrated Circuit design including schematic capture, simulation, mask level layout and design rule checking.</p>
        <span class="skill-tag">S-Edit</span>
        <span class="skill-tag">T-Spice</span>
        <span class="skill-tag">L-Edit</span>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="section-header">
    <h2>Personal Projects</h2>
  </div>

  <div class="personal-projects">
    <div class="project-card">
      <div class="project-content">
        <h3>Containerized Home Server</h3>
        <p>Designed and built a containerized home server environment using Docker on Ubuntu, hosting a range of services for media streaming, home automation, cloud storage, and system management. Key services include: Plex Media Server, Jellyfin Media Server, Nextcloud, Home Assistant, *arr suite (Sonarr, Radarr, Lidarr, Prowlarr, Readarr), Overseerr, Bazarr, Tautulli, qBittorrent, Homarr, Komga, and Portainer for container management. Used HAProxy for reverse proxy and load balancing.</p>
      </div>
    </div>

    <div class="project-card">
      <div class="project-content">
        <h3>Home Network Security</h3>
        <p>Deployed OPNsense firewall with Sunny Valley Zenarmor for advanced network security, implementing intrusion detection and prevention systems based on deep packet inspection to mitigate threats. Integrated Tailscale on the OPNsense router to create a secure, zero-configuration VPN, enabling secure remote access to the home network. Configured UniFi NVR for enhanced security monitoring, providing real-time surveillance and threat analysis. Enhanced network privacy by configuring AdGuard to prevent tracking and malware at the network level.</p>
      </div>
    </div>

     <div class="project-card">
      <div class="project-content">
        <h3>Hackintosh Systems</h3>
        <p>Successfully built multiple stable Hackintosh systems. Achieved optimal hardware compatibility, leveraging a deep understanding of macOS customization and system optimization.</p>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="section-header">
    <h2>Other Contributions</h2>
  </div>
  
  <div class="contributions-list">
    <div class="contribution-item">
      <h3><a href="https://github.com/Bananz0/endlessh-go" target="_blank" rel="noopener noreferrer">endlessh-go</a></h3>
      <p>Go implementation of Endlessh with Prometheus metrics.</p>
    </div>
    
    <div class="contribution-item">
      <h3><a href="https://github.com/Bananz0/Nearby-Sharing-Windows" target="_blank" rel="noopener noreferrer">Nearby-Sharing-Windows</a></h3>
      <p>Android to Windows file sharing.</p>
    </div>
    
    <div class="contribution-item">
      <h3><a href="https://github.com/Bananz0/AudioPlaybackConnector" target="_blank" rel="noopener noreferrer">AudioPlaybackConnector</a></h3>
      <p>Bluetooth audio utility.</p>
    </div>
    
    <div class="contribution-item">
      <h3><a href="https://github.com/Bananz0/Opencore-Lenovo-Thinkpad-G50-80-80E5" target="_blank" rel="noopener noreferrer">Opencore Hackintosh Configs</a></h3>
      <p>Various EFI configurations for laptops.</p>
    </div>
  </div>
</section>

<style>
  .skill-tag {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background-color: rgba(52, 152, 219, 0.1);
    color: var(--primary-color);
    border-radius: 4px;
    font-size: 0.8rem;
    margin-right: 0.5rem;
    margin-top: 0.5rem;
  }
  
  .personal-projects {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 2rem;
  }
  
  .contributions-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 2rem;
  }
  
  .contribution-item {
    background-color: white;
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: var(--box-shadow);
    transition: var(--transition);
  }
  
  .contribution-item:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
  }
  
  .contribution-item h3 {
    margin-top: 0;
  }
</style>