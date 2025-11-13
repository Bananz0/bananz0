---
layout: default
title: Glen Muthoka Mutinda - Portfolio
---

<section class="intro-section">
  <div class="intro-content">
    <h1>Building Systems from Silicon to Software</h1>
    <p class="lead">Electrical & Electronics Engineering student specializing in embedded systems, digital design, and space-grade software development.</p>
    
    <div class="intro-stats">
      <div class="stat-item">
        <span class="stat-number">6%</span>
        <span class="stat-label">Latency Reduction<br>CubeSat Flight Software</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">65nm</span>
        <span class="stat-label">TSMC Process Node<br>IC Design Leadership</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">15%</span>
        <span class="stat-label">Area Reduction<br>Custom Cell Optimization</span>
      </div>
    </div>
  </div>
</section>

<section class="current-work">
  <div class="section-header">
    <h2>Current Focus</h2>
  </div>
  
  <div class="work-grid">
    <div class="work-card highlight">
      <div class="work-icon">🚀</div>
      <h3>ARTEMIS Lunar CubeSat</h3>
      <p>Junior Software Engineer developing flight software in C/C++ for lunar mission. Optimized system latency by 6% and improved reliability by 20% through comprehensive testing frameworks following NASA/MISRA C standards.</p>
    </div>
    
    <div class="work-card highlight">
      <div class="work-icon">💻</div>
      <h3>TSMC 65nm IC Design</h3>
      <p>Leading 6-person team through complete IC fabrication flow from RTL to GDSII tape-out. Designed CPU datapath, performed SPICE simulations, and conducted full physical verification with zero DRC violations.</p>
    </div>
  </div>
</section>

<section class="featured-projects">
  <div class="section-header">
    <h2>Featured Projects</h2>
  </div>
  
  <div class="projects-showcase">
    <div class="project-feature">
      <div class="project-badge">FPGA</div>
      <h3>16-Stage FIR Notch Filter</h3>
      <p>Real-time stereo audio processing on Altera Cyclone V. Achieved 19-cycle latency (950ns @ 50MHz) with parametrized SystemVerilog design. Custom MATLAB coefficient generation for -40dB notch depth.</p>
      <div class="project-tech">
        <span>SystemVerilog</span>
        <span>Quartus Prime</span>
        <span>ModelSim</span>
      </div>
      <a href="https://github.com/Bananz0/FIR-Filter-FPGA" class="project-link">View Project →</a>
    </div>
    
    <div class="project-feature">
      <div class="project-badge">IoT</div>
      <h3>WattsApp Energy Platform</h3>
      <p>ESP32-based smart meter with MQTT/Modbus protocols integrating solar, battery, and grid power. Achieved 12% reduction in peak consumption through intelligent load balancing. React.js dashboard for real-time visualization.</p>
      <div class="project-tech">
        <span>ESP32</span>
        <span>MQTT</span>
        <span>React.js</span>
      </div>
      <a href="https://github.com/Bananz0/WattsApp" class="project-link">View Project →</a>
    </div>
    
    <div class="project-feature">
      <div class="project-badge">Android</div>
      <h3>Somnus Sleep Optimizer</h3>
      <p>Android app calculating optimal wake times using sleep cycle analysis. Integrated with Health Connect for unified health platform access. Custom classification model based on HRV and movement data showing 23% improvement in alertness.</p>
      <div class="project-tech">
        <span>Kotlin</span>
        <span>Health Connect</span>
        <span>ML</span>
      </div>
      <a href="https://github.com/Bananz0/Somnus" class="project-link">View Project →</a>
    </div>
  </div>
  
  <div class="view-all-projects">
    <a href="{{ '/projects' | relative_url }}" class="btn btn-primary">View All Projects</a>
  </div>
</section>

<section class="tech-highlights">
  <div class="section-header">
    <h2>Technical Expertise</h2>
  </div>
  
  <div class="tech-grid">
    <div class="tech-category">
      <h3>🔧 Hardware & Digital Design</h3>
      <p>IC Design (TSMC 65nm) • FPGA (SystemVerilog, Quartus, Vivado) • PCB Design (KiCad, EAGLE) • Embedded Systems (ESP32, STM32, Arduino)</p>
    </div>
    
    <div class="tech-category">
      <h3>💾 Software Development</h3>
      <p>C/C++ • Python • JavaScript/TypeScript • Kotlin • React.js • Node.js • Android SDK • Real-time Systems</p>
    </div>
    
    <div class="tech-category">
      <h3>🔒 Infrastructure & Security</h3>
      <p>OPNsense • Docker • Proxmox • HAProxy • IDS/IPS (Suricata, Zenarmor) • VPN (Tailscale, WireGuard) • 99.8% Uptime</p>
    </div>
  </div>
</section>

<section class="cta-section">
  <div class="cta-content">
    <h2>Interested in collaborating?</h2>
    <p>I'm currently seeking graduate opportunities in embedded systems engineering, digital design, or firmware development.</p>
    <div class="cta-buttons">
      <a href="{{ '/contact' | relative_url }}" class="btn btn-primary">Get In Touch</a>
      <a href="{{ '/projects' | relative_url }}" class="btn btn-secondary">Explore Projects</a>
    </div>
  </div>
</section>

<style>
  .intro-section {
    padding: 3rem 0;
    text-align: center;
  }
  
  .intro-content h1 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    color: var(--primary-color);
  }
  
  .lead {
    font-size: 1.25rem;
    color: #666;
    max-width: 800px;
    margin: 0 auto 3rem;
  }
  
  .intro-stats {
    display: flex;
    justify-content: center;
    gap: 3rem;
    flex-wrap: wrap;
    margin-top: 3rem;
  }
  
  .stat-item {
    text-align: center;
  }
  
  .stat-number {
    display: block;
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--primary-color);
    margin-bottom: 0.5rem;
  }
  
  .stat-label {
    display: block;
    font-size: 0.9rem;
    color: #666;
    line-height: 1.4;
  }
  
  .work-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
  }
  
  .work-card {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: var(--box-shadow);
    transition: var(--transition);
  }
  
  .work-card.highlight {
    border-top: 4px solid var(--primary-color);
  }
  
  .work-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
  }
  
  .work-icon {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }
  
  .work-card h3 {
    margin-top: 0;
    color: var(--text-color);
  }
  
  .projects-showcase {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 2rem;
  }
  
  .project-feature {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: var(--box-shadow);
    transition: var(--transition);
  }
  
  .project-feature:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
  }
  
  .project-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    color: white;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }
  
  .project-feature h3 {
    margin: 0.5rem 0 1rem;
    color: var(--text-color);
  }
  
  .project-tech {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 1rem 0;
  }
  
  .project-tech span {
    padding: 0.25rem 0.75rem;
    background: rgba(52, 152, 219, 0.1);
    border-radius: 4px;
    font-size: 0.85rem;
    color: var(--primary-color);
  }
  
  .project-link {
    display: inline-block;
    margin-top: 1rem;
    color: var(--primary-color);
    font-weight: 600;
    text-decoration: none;
    transition: var(--transition);
  }
  
  .project-link:hover {
    color: var(--secondary-color);
    transform: translateX(5px);
  }
  
  .view-all-projects {
    text-align: center;
    margin-top: 3rem;
  }
  
  .tech-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
  }
  
  .tech-category {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: var(--box-shadow);
  }
  
  .tech-category h3 {
    margin-top: 0;
    color: var(--text-color);
    font-size: 1.25rem;
  }
  
  .tech-category p {
    color: #666;
    line-height: 1.8;
  }
  
  .cta-section {
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    color: white;
    padding: 4rem 2rem;
    border-radius: 8px;
    text-align: center;
    margin-top: 4rem;
  }
  
  .cta-content h2 {
    color: white;
    margin-bottom: 1rem;
  }
  
  .cta-content p {
    font-size: 1.1rem;
    margin-bottom: 2rem;
    opacity: 0.9;
  }
  
  .cta-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .btn {
    display: inline-block;
    padding: 0.75rem 2rem;
    border-radius: 4px;
    text-decoration: none;
    font-weight: 600;
    transition: var(--transition);
  }
  
  .btn-primary {
    background: white;
    color: var(--primary-color);
  }
  
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  }
  
  .btn-secondary {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 2px solid white;
  }
  
  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  @media (max-width: 768px) {
    .intro-content h1 {
      font-size: 2rem;
    }
    
    .intro-stats {
      gap: 2rem;
    }
    
    .stat-number {
      font-size: 2rem;
    }
  }
</style>