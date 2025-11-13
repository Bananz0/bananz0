---
layout: default
title: About Me
---

<section class="about-section">
  <div class="section-header">
    <h2>About Me</h2>
  </div>
  
  <div class="about-content">
    <div class="about-image">
      <!-- Replace with your actual photo when available -->
      <div class="placeholder-image"></div>
    </div>
    
    <div class="about-text">
      <p>I am a second-year <strong>Electrical & Electronics Engineering</strong> student at the <strong>University of Southampton</strong>, passionate about <strong>embedded systems, cybersecurity, and mixed-signal processing</strong>. My experience spans both <strong>hardware and software development</strong>, with hands-on projects in <strong>integrated circuit design, firmware engineering, and network infrastructure</strong>.</p>
      
      <p>Currently, I am a <strong>Junior Software Engineer</strong> contributing to the <strong>ARTEMIS Small Sat-1 Lunar CubeSat Project</strong>, where I work on optimizing flight software and launch control systems.</p>
      
      <div class="about-buttons">
        <a href="{{ '/contact' | relative_url }}" class="btn btn-primary">Get In Touch</a>
        <a href="{{ '/projects' | relative_url }}" class="btn btn-secondary">View Projects</a>
      </div>
    </div>
  </div>
</section>

<section class="education-section">
  <div class="section-header">
    <h2>Education</h2>
  </div>
  
  <div class="timeline">
    {% for edu in site.education %}
    <div class="timeline-item">
      <div class="timeline-marker"></div>
      <div class="timeline-content">
        <h3>{{ edu.institution }}</h3>
        <h4>{{ edu.degree }}</h4>
        <p class="timeline-date">{{ edu.dates }}</p>
      </div>
    </div>
    {% endfor %}
  </div>
</section>

<section class="experience-section">
  <div class="section-header">
    <h2>Experience</h2>
  </div>
  
  <div class="experience-card">
    <div class="experience-header">
      <h3>ARTEMIS Small Sat-1 Lunar CubeSat Project</h3>
      <span class="experience-title">Junior Software Engineer</span>
      <span class="experience-date">August 2023 - Present</span>
    </div>
    
    <div class="experience-content">
      <ul class="experience-list">
        <li>Optimized flight software, reducing system latency by <strong>6%</strong>.</li>
        <li>Improved reliability by <strong>20%</strong> through robust testing and debugging.</li>
        <li>Worked in a collaborative team to develop space-grade software.</li>
      </ul>
    </div>
  </div>
</section>

<section class="certifications-section">