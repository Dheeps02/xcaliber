<template>
  <!-- BUILT FOR -->
  <section class="zs-built-for">
    <div class="zs-container">
      <div class="zs-section-eyebrow">
        <svg width="12" height="12" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z"/></svg>
        Built For
      </div>
      <h2 class="zs-section-title">Who uses ZenScope?</h2>
      <div class="zs-bf-grid">
        <a href="/guide/use-cases" class="zs-bf-card">
          <div class="zs-bf-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="26" height="26"><path d="M56,96v64a8,8,0,0,1-16,0V96a8,8,0,0,1,16,0ZM88,24a8,8,0,0,0-8,8V224a8,8,0,0,0,16,0V32A8,8,0,0,0,88,24Zm40,32a8,8,0,0,0-8,8V192a8,8,0,0,0,16,0V64A8,8,0,0,0,128,56Zm40,32a8,8,0,0,0-8,8v64a8,8,0,0,0,16,0V96A8,8,0,0,0,168,88Zm40-16a8,8,0,0,0-8,8v96a8,8,0,0,0,16,0V80A8,8,0,0,0,208,72Z"/></svg>
          </div>
          <h3>Calibration Engineers</h3>
          <p>Read and write ECU maps, monitor live signals, and iterate calibrations without switching tools. Runs on the bench and on the dyno.</p>
          <span class="zs-bf-link">View use cases →</span>
        </a>
        <a href="/reference/rest-api" class="zs-bf-card">
          <div class="zs-bf-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="26" height="26"><path d="M128,128a8,8,0,0,1-3,6.25l-40,32a8,8,0,1,1-10-12.5L107.19,128,75,102.25a8,8,0,1,1,10-12.5l40,32A8,8,0,0,1,128,128Zm48,24H136a8,8,0,0,0,0,16h40a8,8,0,0,0,0-16Zm56-96V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56ZM216,200V56H40V200H216Z"/></svg>
          </div>
          <h3>Test Automation</h3>
          <p>Drive measurements and calibrations from CI pipelines using the REST API. Script connect, DAQ, and disconnect — no GUI required.</p>
          <span class="zs-bf-link">Read the API docs →</span>
        </a>
        <a href="/features/trace" class="zs-bf-card">
          <div class="zs-bf-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="26" height="26"><path d="M208,136H48a16,16,0,0,0-16,16v40a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V152A16,16,0,0,0,208,136Zm0,56H48V152H208v40Zm0-144H48A16,16,0,0,0,32,64v40a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V64A16,16,0,0,0,208,48Zm0,56H48V64H208v40Z"/></svg>
          </div>
          <h3>Reverse Engineering</h3>
          <p>Inspect raw XCP frames, trace undocumented memory regions, and build a picture of unknown ECU internals — every byte visible.</p>
          <span class="zs-bf-link">Explore packet trace →</span>
        </a>
      </div>
    </div>
  </section>

  <!-- TECH STACK -->
  <section class="zs-stack">
    <div class="zs-container">
      <div class="zs-section-eyebrow">Technology</div>
      <h2 class="zs-section-title">What's under the hood</h2>
      <div class="zs-stack-pills">
        <span class="zs-stack-pill">Rust</span>
        <span class="zs-stack-pill">Electron</span>
        <span class="zs-stack-pill">React</span>
        <span class="zs-stack-pill">TypeScript</span>
        <span class="zs-stack-pill">Vite</span>
        <span class="zs-stack-pill">SQLite</span>
        <span class="zs-stack-pill">ASAM XCP</span>
        <span class="zs-stack-pill">Server-Sent Events</span>
      </div>
      <a href="/reference/architecture" class="zs-link-underline">Architecture overview →</a>
    </div>
  </section>
</template>

<style scoped>
.zs-built-for { padding: 100px 0; border-top: 1px solid var(--zs-border); }
.zs-bf-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin: 52px 0 32px; }
.zs-bf-card {
  display: block; text-decoration: none;
  background: var(--zs-panel); border: 1px solid var(--zs-border);
  border-radius: 14px; padding: 32px;
  transition: border-color 0.2s, transform 0.2s;
}
.zs-bf-card:hover { border-color: rgba(16,185,129,0.40); transform: translateY(-3px); }
.zs-bf-icon {
  width: 52px; height: 52px; background: rgba(16,185,129,0.10);
  border: 1px solid rgba(16,185,129,0.18); border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  color: var(--zs-accent-2); margin-bottom: 18px;
  transition: background 0.2s, border-color 0.2s, color 0.2s, transform 0.2s;
}
.zs-bf-card:hover .zs-bf-icon {
  background: rgba(16,185,129,0.22); border-color: rgba(16,185,129,0.50);
  color: #d1fae5; transform: scale(1.08) rotate(5deg);
}
.zs-bf-icon svg { transition: filter 0.2s ease; }
.zs-bf-card:hover .zs-bf-icon svg { filter: drop-shadow(0 0 6px rgba(110,231,183,0.70)); }
.zs-bf-card h3 { font-size: 17px; font-weight: 600; color: var(--zs-text); margin-bottom: 10px; letter-spacing: -0.01em; }
.zs-bf-card p { font-size: 14px; line-height: 1.65; color: var(--zs-muted); margin-bottom: 16px; }
.zs-bf-link { font-size: 13px; color: var(--zs-accent-2); }

.zs-stack { padding: 80px 0; border-top: 1px solid var(--zs-border); }
.zs-stack-pills { display: flex; flex-wrap: wrap; gap: 10px; margin: 28px 0 24px; }
.zs-stack-pill {
  font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--zs-muted);
  background: rgba(255,255,255,0.04); border: 1px solid var(--zs-border); border-radius: 7px; padding: 7px 16px;
}

@media (max-width: 960px) { .zs-bf-grid { grid-template-columns: 1fr; } }
</style>
