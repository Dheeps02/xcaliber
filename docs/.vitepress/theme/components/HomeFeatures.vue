<template>
  <!-- FEATURES GRID -->
  <section class="zs-features">
    <div class="zs-container">
      <div class="zs-section-eyebrow">
        <svg width="12" height="12" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M215.79,118.17a8,8,0,0,0-5-5.66L153.18,90.9l14.66-73.33a8,8,0,0,0-13.69-7l-112,120a8,8,0,0,0,3,13l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l112-120A8,8,0,0,0,215.79,118.17Z"/></svg>
        Features
      </div>
      <h2 class="zs-section-title">Everything you need for XCP</h2>
      <p class="zs-section-sub">Built for calibration engineers who demand precision and speed.</p>
      <div class="zs-features-grid">

        <a href="/features/daq" class="zs-feature-card">
          <div class="zs-feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M56,96v64a8,8,0,0,1-16,0V96a8,8,0,0,1,16,0ZM88,24a8,8,0,0,0-8,8V224a8,8,0,0,0,16,0V32A8,8,0,0,0,88,24Zm40,32a8,8,0,0,0-8,8V192a8,8,0,0,0,16,0V64A8,8,0,0,0,128,56Zm40,32a8,8,0,0,0-8,8v64a8,8,0,0,0,16,0V96A8,8,0,0,0,168,88Zm40-16a8,8,0,0,0-8,8v96a8,8,0,0,0,16,0V80A8,8,0,0,0,208,72Z"/></svg>
          </div>
          <h3 class="zs-feature-title">Live DAQ Streaming</h3>
          <p class="zs-feature-desc">Configure DAQ lists, ODTs, and entries, then stream live measurement values from the ECU over SSE — no polling.</p>
        </a>

        <a href="/features/daq" class="zs-feature-card">
          <div class="zs-feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1-8-8V48a8,8,0,0,1,16,0v94.37L90.73,98a8,8,0,0,1,10.07-.38l58.81,44.11L218.73,90a8,8,0,1,1,10.54,12l-64,56a8,8,0,0,1-10.07.38L96.39,114.29,40,163.63V200H224A8,8,0,0,1,232,208Z"/></svg>
          </div>
          <h3 class="zs-feature-title">Live Sparkline Plots</h3>
          <p class="zs-feature-desc">Per-signal mini charts update in real time as values stream in — at a glance, for every signal in the list.</p>
        </a>

        <a href="/features/trace" class="zs-feature-card">
          <div class="zs-feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M208,136H48a16,16,0,0,0-16,16v40a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V152A16,16,0,0,0,208,136Zm0,56H48V152H208v40Zm0-144H48A16,16,0,0,0,32,64v40a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V64A16,16,0,0,0,208,48Zm0,56H48V64H208v40Z"/></svg>
          </div>
          <h3 class="zs-feature-title">Full Packet Trace</h3>
          <p class="zs-feature-desc">Complete TX/RX log with hex view, decoded fields, and filtering — every byte sent and received.</p>
        </a>

        <a href="/reference/architecture" class="zs-feature-card">
          <div class="zs-feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M237.66,18.34a8,8,0,0,0-11.32,0l-52.4,52.41-5.37-5.38a32.05,32.05,0,0,0-45.26,0L100,88.69l-6.34-6.35A8,8,0,0,0,82.34,93.66L88.69,100,65.37,123.31a32,32,0,0,0,0,45.26l5.38,5.37-52.41,52.4a8,8,0,0,0,11.32,11.32l52.4-52.41,5.37,5.38a32,32,0,0,0,45.26,0L156,167.31l6.34,6.35a8,8,0,0,0,11.32-11.32L167.31,156l23.32-23.31a32,32,0,0,0,0-45.26l-5.38-5.37,52.41-52.4A8,8,0,0,0,237.66,18.34Z"/></svg>
          </div>
          <h3 class="zs-feature-title">XCP over UDP</h3>
          <p class="zs-feature-desc">UDP socket and raw Ethernet transport modes, with configurable XCP-on-UDP settings. TCP support is planned for a future release.</p>
        </a>

        <a href="/guide/configuration" class="zs-feature-card">
          <div class="zs-feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M128,128a8,8,0,0,1-3,6.25l-40,32a8,8,0,1,1-10-12.5L107.19,128,75,102.25a8,8,0,1,1,10-12.5l40,32A8,8,0,0,1,128,128Zm48,24H136a8,8,0,0,0,0,16h40a8,8,0,0,0,0-16Zm56-96V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56ZM216,200V56H40V200H216Z"/></svg>
          </div>
          <h3 class="zs-feature-title">Custom Commands</h3>
          <p class="zs-feature-desc">Define USER_CMD packets via TOML config with named fields, sent from the Commands tab — no raw hex required.</p>
        </a>

        <a href="/features/daq" class="zs-feature-card">
          <div class="zs-feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M219.31,72,184,36.69A15.86,15.86,0,0,0,172.69,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V83.31A15.86,15.86,0,0,0,219.31,72ZM168,208H88V152h80Zm40,0H184V152a16,16,0,0,0-16-16H88a16,16,0,0,0-16,16v56H48V48H172.69L208,83.31ZM160,72a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h56A8,8,0,0,1,160,72Z"/></svg>
          </div>
          <h3 class="zs-feature-title">Save &amp; Replay</h3>
          <p class="zs-feature-desc">Export and import <code>.daq</code> files for reusable measurement setups — no rebuilding a DAQ list from scratch each session.</p>
        </a>

        <a href="/reference/architecture" class="zs-feature-card">
          <div class="zs-feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M128,24C74.17,24,32,48.6,32,80v96c0,31.4,42.17,56,96,56s96-24.6,96-56V80C224,48.6,181.83,24,128,24Zm80,104c0,9.62-7.88,19.43-21.61,26.92C170.93,163.35,150.19,168,128,168s-42.93-4.65-58.39-13.08C55.88,147.43,48,137.62,48,128V111.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64ZM69.61,53.08C85.07,44.65,105.81,40,128,40s42.93,4.65,58.39,13.08C200.12,60.57,208,70.38,208,80s-7.88,19.43-21.61,26.92C170.93,115.35,150.19,120,128,120s-42.93-4.65-58.39-13.08C55.88,99.43,48,89.62,48,80S55.88,60.57,69.61,53.08ZM186.39,202.92C170.93,211.35,150.19,216,128,216s-42.93-4.65-58.39-13.08C55.88,195.43,48,185.62,48,176V159.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64V176C208,185.62,200.12,195.43,186.39,202.92Z"/></svg>
          </div>
          <h3 class="zs-feature-title">SQLite Packet History</h3>
          <p class="zs-feature-desc">Every packet persisted as it happens — restart the app and your trace and DAQ history are still there.</p>
        </a>

        <a href="/guide/configuration" class="zs-feature-card">
          <div class="zs-feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M200.77,53.89A103.27,103.27,0,0,0,128,24h-1.07A104,104,0,0,0,24,128c0,43,26.58,79.06,69.36,94.17A32,32,0,0,0,136,192a16,16,0,0,1,16-16h46.21a31.81,31.81,0,0,0,31.2-24.88,104.43,104.43,0,0,0,2.59-24A103.28,103.28,0,0,0,200.77,53.89Zm13,93.71A15.89,15.89,0,0,1,198.21,160H152a32,32,0,0,0-32,32,16,16,0,0,1-21.31,15.07C62.49,194.3,40,164,40,128a88,88,0,0,1,87.09-88h.9a88.35,88.35,0,0,1,88,87.25A88.86,88.86,0,0,1,213.81,147.6ZM140,76a12,12,0,1,1-12-12A12,12,0,0,1,140,76ZM96,100A12,12,0,1,1,84,88,12,12,0,0,1,96,100Zm0,56a12,12,0,1,1-12-12A12,12,0,0,1,96,156Zm88-56a12,12,0,1,1-12-12A12,12,0,0,1,184,100Z"/></svg>
          </div>
          <h3 class="zs-feature-title">10+ Themes</h3>
          <p class="zs-feature-desc">Nord, Catppuccin, Gruvbox, Everforest, OLED, and more — pick the one that matches your setup and switch instantly.</p>
        </a>

        <a href="/reference/rest-api" class="zs-feature-card">
          <div class="zs-feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M215.79,118.17a8,8,0,0,0-5-5.66L153.18,90.9l14.66-73.33a8,8,0,0,0-13.69-7l-112,120a8,8,0,0,0,3,13l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l112-120A8,8,0,0,0,215.79,118.17Z"/></svg>
          </div>
          <h3 class="zs-feature-title">Real-Time Push</h3>
          <p class="zs-feature-desc">SSE-based live push for packets and DTOs — the UI reflects the wire as it happens, not on a timer.</p>
        </a>

      </div>
    </div>
  </section>

  <!-- TRACE SHOWCASE -->
  <section class="zs-showcase-split">
    <div class="zs-container zs-showcase-split-inner">
      <div class="zs-showcase-copy">
        <div class="zs-section-eyebrow">
          <svg width="12" height="12" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M208,136H48a16,16,0,0,0-16,16v40a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V152A16,16,0,0,0,208,136Zm0,56H48V152H208v40Zm0-144H48A16,16,0,0,0,32,64v40a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V64A16,16,0,0,0,208,48Zm0,56H48V64H208v40Z"/></svg>
          Packet Trace
        </div>
        <h2 class="zs-section-title">See every XCP frame</h2>
        <p class="zs-section-sub">Real-time capture with colour-coded frame types, hex decode, and timeline filtering. Every byte, always there.</p>
        <a href="/features/trace" class="zs-btn-primary zs-btn-sm">Explore Trace →</a>
      </div>
      <div class="zs-window-chrome zs-window-chrome-side">
        <div class="zs-window-chrome-bar">
          <span class="zs-chrome-dot"></span><span class="zs-chrome-dot"></span><span class="zs-chrome-dot"></span>
          <span class="zs-chrome-title">ZenScope — XCP Trace</span>
        </div>
        <!-- replace with: <img src="/media/trace.png" alt="XCP Trace view"> 1200×800 -->
        <div class="zs-img-placeholder">
          <div class="zs-placeholder-inner">
            <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            <span>XCP Trace Screenshot</span>
            <span class="zs-placeholder-hint">/media/trace.png — 1200×800</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.zs-features { padding: 100px 0; border-top: 1px solid var(--zs-border); }
.zs-features .zs-container { text-align: center; }
.zs-features .zs-section-eyebrow { justify-content: center; }
.zs-features .zs-section-sub { margin: 0 auto 52px; }
.zs-features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; text-align: left; }

.zs-feature-card {
  display: block; text-decoration: none;
  background: var(--zs-panel); border: 1px solid var(--zs-border);
  border-radius: 14px; padding: 28px;
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
}
.zs-feature-card:hover {
  border-color: rgba(16,185,129,0.40); transform: translateY(-4px);
  box-shadow: 0 16px 40px rgba(16,185,129,0.08);
}
.zs-feature-card:active { transform: translateY(-1px) scale(0.99); }

.zs-feature-icon {
  width: 44px; height: 44px;
  background: rgba(16,185,129,0.10); border: 1px solid rgba(16,185,129,0.18);
  border-radius: 10px; display: flex; align-items: center; justify-content: center;
  color: var(--zs-accent-2); margin-bottom: 16px;
  transition: background 0.2s, border-color 0.2s, color 0.2s, transform 0.2s;
}
.zs-feature-card:hover .zs-feature-icon {
  background: rgba(16,185,129,0.22); border-color: rgba(16,185,129,0.50);
  color: #d1fae5; transform: scale(1.08) rotate(5deg);
}
.zs-feature-icon svg { transition: transform 0.2s ease, filter 0.2s ease; }
.zs-feature-card:hover .zs-feature-icon svg {
  transform: scale(1.1);
  filter: drop-shadow(0 0 6px rgba(110,231,183,0.70));
}

.zs-feature-title { font-size: 16px; font-weight: 600; color: var(--zs-text); margin-bottom: 8px; letter-spacing: -0.01em; }
.zs-feature-desc { font-size: 14px; line-height: 1.65; color: var(--zs-muted); }
.zs-feature-desc code {
  font-family: 'JetBrains Mono', monospace; font-size: 12.5px;
  color: var(--zs-accent-2); background: rgba(16,185,129,0.1); padding: 1px 5px; border-radius: 3px;
}

.zs-showcase-split { padding: 80px 0 100px; border-top: 1px solid var(--zs-border); }
.zs-showcase-split-inner { display: flex; gap: 64px; align-items: center; }
.zs-showcase-copy { flex: 1; min-width: 0; }
.zs-showcase-copy .zs-section-title { margin-top: 8px; margin-bottom: 14px; }
.zs-showcase-copy .zs-section-sub { margin-bottom: 24px; max-width: 400px; }
.zs-window-chrome-side { flex: 1.5; }

@media (max-width: 960px) {
  .zs-features-grid { grid-template-columns: repeat(2, 1fr); }
  .zs-showcase-split-inner { flex-direction: column-reverse; }
  .zs-window-chrome-side { width: 100%; flex: none; }
}
@media (max-width: 600px) {
  .zs-features-grid { grid-template-columns: 1fr; }
}
</style>
