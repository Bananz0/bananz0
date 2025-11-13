---
layout: default
title: Skills
---

<section>
  <div class="section-header">
    <h2>Technical Skills</h2>
  </div>

  <div class="skills-container">
    <div class="skill-category">
      <h3>Programming Languages</h3>
      <div class="skill-list">
        <div class="skill-group">
          <h4>Primary</h4>
          <div class="skill-item">SystemVerilog</div>
          <div class="skill-item">C++</div>
          <div class="skill-item">Python</div>
          <div class="skill-item">JavaScript</div>
        </div>
        <div class="skill-group">
          <h4>Secondary</h4>
          <div class="skill-item">C#</div>
          <div class="skill-item">MATLAB</div>
        </div>
      </div>
    </div>

    <div class="skill-category">
      <h3>Frameworks & Libraries</h3>
      <div class="skill-group">
        <h4>Web Development</h4>
        <div class="skill-item">React.js</div>
        <div class="skill-item">Node.js</div>
        <div class="skill-item">Express.js</div>
      </div>
      <div class="skill-group">
        <h4>Scientific Computing</h4>
        <div class="skill-item">MATLAB (Control Systems Toolbox)</div>
        <div class="skill-item">MATLAB (Symbolic Math Toolbox)</div>
      </div>
    </div>

     <div class="skill-category">
      <h3>Hardware & Embedded Systems</h3>
      <div class="skill-item">IC Design (TSMC 65nm)</div>
      <div class="skill-item">Arduino</div>
      <div class="skill-item">Raspberry Pi</div>
      <div class="skill-item">PCB Design (KiCad, EAGLE)</div>
      <div class="skill-item">LTSpice</div>
       <div class="skill-item">Multisim</div>
       <div class="skill-item">Simulink Simscape</div>

    </div>

    <div class="skill-category">
      <h3>Cybersecurity & Networking</h3>
      <div class="skill-item">OPNsense Firewall</div>
      <div class="skill-item">UniFi Network Management</div>
      <div class="skill-item">HAProxy (Load Balancing, Reverse Proxy)</div>
      <div class="skill-item">AdGuard (Network-Wide Ad Blocking)</div>
      <div class="skill-item">SSL/TLS Configuration</div>
    </div>
  </div>
</section>

<section>
  <div class="section-header">
    <h2>Home Server & Infrastructure</h2>
  </div>

  <div class="skills-container">
    <div class="skill-category">
      <h3>Server Administration</h3>
      <div class="skill-item">Linux System Administration (Ubuntu, Debian)</div>
      <div class="skill-item">Docker Containerization</div>
      <div class="skill-item">Portainer Management</div>
      <div class="skill-item">Samba File Sharing</div>
      <div class="skill-item">Print Server Configuration</div>
      <div class="skill-item">WSL (Windows Subsystem for Linux)</div>
      <div class="skill-item">Reverse Proxy Configuration (HAProxy)</div>
       <div class="skill-item">ACME (Let's Encrypt) Certificate Management</div>
      <div class="skill-item">Load Balancing</div>
      <div class="skill-item">Monitoring (Grafana, Prometheus - If applicable)</div>

    </div>

    <div class="skill-category">
      <h3>Media & Home Automation</h3>
      <div class="skill-item">Plex Media Server</div>
      <div class="skill-item">Jellyfin Media Server</div>
      <div class="skill-item">Home Assistant</div>
      <div class="skill-item">*arr Suite (Sonarr, Radarr, Lidarr, Prowlarr, Readarr)</div>
      <div class="skill-item">Overseerr Request Management</div>
      <div class="skill-item">Bazarr Subtitle Management</div>
    </div>

    <div class="skill-category">
      <h3>Cloud & Productivity</h3>
      <div class="skill-item">Nextcloud (Self-Hosted Cloud)</div>
       <div class="skill-item">Proxmox Virtualization</div>
      <div class="skill-item">Cockpit Server Management</div>
      <div class="skill-item">Komga Comic Server</div>

    </div>
  </div>
</section>

<section>
  <div class="section-header">
    <h2>Tools & Technologies</h2>
  </div>

  <div class="skills-container">
    <div class="skill-category">
      <h3>Development Tools</h3>
      <div class="skill-item">Git & Version Control</div>
      <div class="skill-item">VS Code & CLion</div>
       <div class="skill-item">Android Studio</div>
      <div class="skill-item">Fusion 360 (CAD/CAM)</div>
      <div class="skill-item">Jupyter Notebook</div>
      <div class="skill-item">MATLAB Simulink</div>
    </div>

    <div class="skill-category">
      <h3>Concepts & Domains</h3>
      <div class="skill-item">Embedded Systems</div>
      <div class="skill-item">Network Security</div>
      <div class="skill-item">IoT</div>
      <div class="skill-item">Machine Learning</div>
      <div class="skill-item">Cross-Platform Development</div>
      <div class="skill-item">Hackintoshing</div>
    </div>
  </div>
</section>

<style>
  .skills-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 2rem;
    margin-bottom: 3rem;
  }

  .skill-category {
    background-color: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: var(--box-shadow);
  }

  .skill-category h3 {
    color: var(--primary-color);
    border-bottom: 2px solid var(--border-color);
    padding-bottom: 0.5rem;
    margin-bottom: 1.5rem;
  }
  
  .skill-group {
    margin-bottom: 1.5rem;
  }
  
  .skill-group h4 {
    color: var(--secondary-color);
    margin-bottom: 0.5rem;
    font-size: 1.1rem;
  }

  .skill-item {
    margin-bottom: 0.5rem;
    padding-left: 1rem;
    position: relative;
  }

  .skill-item:before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.6rem;
    width: 8px;
    height: 8px;
    background-color: var(--accent-color);
    border-radius: 50%;
  }
</style>