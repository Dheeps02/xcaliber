<script setup>
function onCopy(e) {
  const btn = e.currentTarget
  const txt = btn.getAttribute('data-copy') || ''
  if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {})
  const lbl = btn.querySelector('[data-lbl]')
  if (lbl) { const orig = lbl.textContent; lbl.textContent = 'Copied'; setTimeout(() => { lbl.textContent = orig }, 1300) }
}
</script>

<template>
  <!-- ARCHITECTURE -->
  <section class="zs-arch">
    <div class="zs-container">
      <div class="zs-section-eyebrow">
        <svg width="12" height="12" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M69.12 94.15 28.5 128l40.62 33.85a8 8 0 1 1-10.24 12.29l-48-40a8 8 0 0 1 0-12.29l48-40a8 8 0 0 1 10.24 12.3Zm176 27.71-48-40a8 8 0 1 0-10.24 12.29L227.5 128l-40.62 33.85a8 8 0 1 0 10.24 12.29l48-40a8 8 0 0 0 0-12.28Z"/></svg>
        Architecture
      </div>
      <h2 class="zs-section-title">Frontend meets Rust</h2>
      <p class="zs-section-sub">A native Rust XCP engine runs as a sidecar process alongside the Electron shell — zero compromises on performance or hardware access.</p>

      <div class="zs-arch-diagram">
        <div class="zs-arch-box zs-arch-box-ui">
          <div class="zs-arch-box-header">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M232,168h-8V72a16,16,0,0,0-16-16H48a16,16,0,0,0-16,16v96H24a8,8,0,0,0,0,16H208a8,8,0,0,0,0-16Zm-24 0H48V72h160Zm-64,24H112a8,8,0,0,1,0-16h32a8,8,0,0,1,0,16Z"/></svg>
            <span class="zs-arch-label">Electron Shell</span>
            <span class="zs-arch-lang">TypeScript + React</span>
          </div>
          <div class="zs-arch-items">
            <span class="zs-arch-item">DAQ View</span>
            <span class="zs-arch-item">Trace View</span>
            <span class="zs-arch-item">Command Bar</span>
            <span class="zs-arch-item">Settings</span>
            <span class="zs-arch-item">10+ Themes</span>
          </div>
        </div>

        <div class="zs-arch-arrow-col">
          <div class="zs-arch-conn">
            <svg width="32" height="12" fill="none" viewBox="0 0 32 12"><path d="M0 6h28M22 1l6 5-6 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="zs-arch-conn-label">IPC</span>
          </div>
          <div class="zs-arch-conn zs-arch-conn-rev">
            <svg width="32" height="12" fill="none" viewBox="0 0 32 12"><path d="M32 6H4M10 1 4 6l6 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="zs-arch-conn-label">REST / SSE</span>
          </div>
        </div>

        <div class="zs-arch-box zs-arch-box-core">
          <div class="zs-arch-box-header">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M215.79,118.17a8,8,0,0,0-5-5.66L153.18,90.9l14.66-73.33a8,8,0,0,0-13.69-7l-112,120a8,8,0,0,0,3,13l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l112-120A8,8,0,0,0,215.79,118.17Z"/></svg>
            <span class="zs-arch-label">ZenScope Core</span>
            <span class="zs-arch-lang">Rust sidecar binary</span>
          </div>
          <div class="zs-arch-items">
            <span class="zs-arch-item zs-arch-item-accent">XCP Engine</span>
            <span class="zs-arch-item zs-arch-item-accent">REST API (HTTP)</span>
            <span class="zs-arch-item zs-arch-item-accent">SSE Stream</span>
            <span class="zs-arch-item zs-arch-item-accent">DAQ Scheduler</span>
            <span class="zs-arch-item zs-arch-item-accent">SQLite Logger</span>
          </div>
        </div>

        <div class="zs-arch-arrow-col">
          <div class="zs-arch-conn">
            <svg width="32" height="12" fill="none" viewBox="0 0 32 12"><path d="M0 6h28M22 1l6 5-6 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="zs-arch-conn-label">XCP/UDP</span>
          </div>
          <div class="zs-arch-conn zs-arch-conn-rev">
            <svg width="32" height="12" fill="none" viewBox="0 0 32 12"><path d="M32 6H4M10 1 4 6l6 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="zs-arch-conn-label">Raw Ethernet</span>
          </div>
        </div>

        <div class="zs-arch-box zs-arch-box-ecu">
          <div class="zs-arch-box-header">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M200,168a8,8,0,0,1-8,8H152a8,8,0,0,1,0-16h40A8,8,0,0,1,200,168Zm-48-40h40a8,8,0,0,0,0-16H152a8,8,0,0,0,0,16Zm96-72V200a16,16,0,0,1-16,16H24a16,16,0,0,1-16-16V56A16,16,0,0,1,24,40H232A16,16,0,0,1,248,56ZM232,200V56H24V200H232Z"/></svg>
            <span class="zs-arch-label">Target ECU</span>
            <span class="zs-arch-lang">XCP Slave device</span>
          </div>
          <div class="zs-arch-items">
            <span class="zs-arch-item">Memory Maps</span>
            <span class="zs-arch-item">Calibration Data</span>
            <span class="zs-arch-item">Measurement Values</span>
          </div>
        </div>
      </div>
      <a href="/reference/architecture" class="zs-link-underline">Read the architecture guide →</a>
    </div>
  </section>

  <!-- REST API -->
  <section class="zs-api">
    <div class="zs-container">
      <div class="zs-api-inner">
        <div class="zs-api-copy">
          <div class="zs-section-eyebrow">
            <svg width="12" height="12" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M69.12 94.15 28.5 128l40.62 33.85a8 8 0 1 1-10.24 12.29l-48-40a8 8 0 0 1 0-12.29l48-40a8 8 0 0 1 10.24 12.3Zm176 27.71-48-40a8 8 0 1 0-10.24 12.29L227.5 128l-40.62 33.85a8 8 0 1 0 10.24 12.29l48-40a8 8 0 0 0 0-12.28Zm-82.39-89.63a8 8 0 0 0-10.25 4.77l-64 176a8 8 0 0 0 4.77 10.25A7.77 7.77 0 0 0 96 224a8 8 0 0 0 7.52-5.23l64-176a8 8 0 0 0-4.79-10.54Z"/></svg>
            REST API
          </div>
          <h2 class="zs-section-title">Automate everything</h2>
          <p class="zs-section-sub">A full HTTP API ships with every install. Integrate ZenScope into test benches, CI pipelines, and custom tooling without touching the UI.</p>
          <table class="zs-api-table">
            <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><span class="zs-method zs-get">GET</span></td><td><code>/api/daq/status</code></td><td>Session status &amp; rate</td></tr>
              <tr><td><span class="zs-method zs-post">POST</span></td><td><code>/api/daq/start</code></td><td>Start a DAQ measurement</td></tr>
              <tr><td><span class="zs-method zs-post">POST</span></td><td><code>/api/daq/stop</code></td><td>Stop active DAQ session</td></tr>
              <tr><td><span class="zs-method zs-get">GET</span></td><td><code>/api/variables</code></td><td>List calibration variables</td></tr>
              <tr><td><span class="zs-method zs-post">POST</span></td><td><code>/api/variables/:name</code></td><td>Write a variable value</td></tr>
              <tr><td><span class="zs-method zs-get">GET</span></td><td><code>/api/trace</code></td><td>Stream XCP packets (SSE)</td></tr>
            </tbody>
          </table>
          <a href="/reference/rest-api" class="zs-btn-ghost">Read the API docs →</a>
        </div>
        <div class="zs-api-code-block">
          <div class="zs-code-bar">
            <span class="zs-code-lang">bash</span>
            <button class="zs-copy-btn" data-copy='curl -X POST http://localhost:8080/api/daq/start \
  -H "Content-Type: application/json" \
  -d "{\"variables\":[\"ENGINE_RPM\",\"THROTTLE_POS\"],\"rate_ms\":10}"' @click="onCopy" aria-label="Copy">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span data-lbl>Copy</span>
            </button>
          </div>
          <pre class="zs-code"><code><span class="zs-c-dim">$ </span>curl -X POST http://localhost:8080/api/daq/start \
  -H <span class="zs-c-str">'Content-Type: application/json'</span> \
  -d <span class="zs-c-str">'{
    "variables": ["ENGINE_RPM", "THROTTLE_POS"],
    "rate_ms": 10
  }'</span></code></pre>
        </div>
      </div>
    </div>
  </section>

  <!-- QUICKSTART -->
  <section class="zs-quickstart">
    <div class="zs-container">
      <div class="zs-section-eyebrow">
        <svg width="12" height="12" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M215.79,118.17a8,8,0,0,0-5-5.66L153.18,90.9l14.66-73.33a8,8,0,0,0-13.69-7l-112,120a8,8,0,0,0,3,13l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l112-120A8,8,0,0,0,215.79,118.17Z"/></svg>
        Quickstart
      </div>
      <h2 class="zs-section-title">Up and running in minutes</h2>
      <div class="zs-qs-grid">
        <div class="zs-qs-step">
          <div class="zs-qs-num">01</div>
          <h3 class="zs-qs-title">Clone &amp; Install</h3>
          <div class="zs-code-block-sm">
            <div class="zs-code-bar">
              <span class="zs-code-lang">bash</span>
              <button class="zs-copy-btn" data-copy="git clone https://github.com/Dheeps02/xcaliber.git
cd xcaliber
npm install && cd frontend && npm install && cd .." @click="onCopy" aria-label="Copy">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"/></svg>
                <span data-lbl>Copy</span>
              </button>
            </div>
            <pre><code>git clone https://github.com/Dheeps02/xcaliber.git
cd xcaliber
npm install &amp;&amp; cd frontend &amp;&amp; npm install &amp;&amp; cd ..</code></pre>
          </div>
        </div>
        <div class="zs-qs-step">
          <div class="zs-qs-num">02</div>
          <h3 class="zs-qs-title">Run</h3>
          <div class="zs-code-block-sm">
            <div class="zs-code-bar">
              <span class="zs-code-lang">bash</span>
              <button class="zs-copy-btn" data-copy="npm run dev" @click="onCopy" aria-label="Copy">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"/></svg>
                <span data-lbl>Copy</span>
              </button>
            </div>
            <pre><code>npm run dev</code></pre>
          </div>
          <p class="zs-qs-desc">Electron + Vite start together. Hot reload on the frontend.</p>
        </div>
        <div class="zs-qs-step">
          <div class="zs-qs-num">03</div>
          <h3 class="zs-qs-title">Connect &amp; Measure</h3>
          <p class="zs-qs-desc">Point ZenScope at your XCP target — or use the bundled mock slave at <code>127.0.0.1:5555</code> if you don't have an ECU on hand.</p>
          <a href="/guide/getting-started" class="zs-link-underline">Full getting-started guide →</a>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ── Architecture ── */
.zs-arch { padding: 100px 0; border-top: 1px solid var(--zs-border); }
.zs-arch-diagram {
  display: flex; align-items: stretch; gap: 0;
  margin: 52px 0 32px; overflow-x: auto; padding-bottom: 8px;
}
.zs-arch-box {
  flex: 1; min-width: 200px; border: 1px solid var(--zs-border);
  border-radius: 14px; padding: 24px; background: var(--zs-panel);
}
.zs-arch-box-ui  { border-color: rgba(16,185,129,0.25); }
.zs-arch-box-core { border-color: rgba(16,185,129,0.55); background: rgba(16,185,129,0.05); }
.zs-arch-box-ecu  { border-color: rgba(16,185,129,0.18); }
.zs-arch-box-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.zs-arch-box-header svg { color: var(--zs-accent-2); flex-shrink: 0; }
.zs-arch-label { font-size: 13px; font-weight: 600; color: var(--zs-text); }
.zs-arch-lang { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--zs-faint); margin-left: auto; }
.zs-arch-items { display: flex; flex-direction: column; gap: 6px; }
.zs-arch-item {
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: var(--zs-muted); background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06); border-radius: 5px; padding: 4px 10px;
}
.zs-arch-item-accent { color: var(--zs-accent-2); background: rgba(16,185,129,0.07); border-color: rgba(16,185,129,0.14); }
.zs-arch-arrow-col {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 12px; padding: 0 16px; flex-shrink: 0;
}
.zs-arch-conn { display: flex; flex-direction: column; align-items: center; gap: 3px; color: var(--zs-faint); }
.zs-arch-conn-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--zs-faint); white-space: nowrap; }

/* ── REST API ── */
.zs-api { padding: 100px 0; border-top: 1px solid var(--zs-border); }
.zs-api-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: start; }
.zs-api-copy .zs-section-sub { margin-bottom: 24px; }
.zs-api-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
.zs-api-table th {
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  text-transform: uppercase; letter-spacing: 0.08em; color: var(--zs-faint);
  padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--zs-border);
}
.zs-api-table td { padding: 10px 12px; color: var(--zs-muted); border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
.zs-api-table td code { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--zs-text); }
.zs-method { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; padding: 3px 7px; border-radius: 4px; white-space: nowrap; }
.zs-get  { background: rgba(16,185,129,0.12); color: #34d399; }
.zs-post { background: rgba(16,185,129,0.08); color: var(--zs-accent-2); }
.zs-api-code-block { background: #2d353b; border: 1px solid var(--zs-border); border-radius: 12px; overflow: hidden; }
.zs-code-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; background: rgba(0,0,0,0.15); border-bottom: 1px solid rgba(255,255,255,0.06);
}
.zs-code-lang { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #859289; text-transform: uppercase; letter-spacing: 0.08em; }
.zs-code { padding: 20px; margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.75; overflow-x: auto; color: #d3c6aa; }
.zs-c-dim { color: #859289; }
.zs-c-str { color: #a7c080; }

/* ── Quickstart ── */
.zs-quickstart { padding: 100px 0; border-top: 1px solid var(--zs-border); }
.zs-qs-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 48px; margin-top: 52px; }
.zs-qs-num { font-family: 'Cormorant Garamond', serif; font-size: 56px; font-weight: 500; color: rgba(16,185,129,0.2); line-height: 1; margin-bottom: 14px; }
.zs-qs-title { font-size: 18px; font-weight: 600; color: var(--zs-text); margin-bottom: 16px; letter-spacing: -0.01em; }
.zs-qs-desc { font-size: 15px; line-height: 1.65; color: var(--zs-muted); margin-bottom: 16px; }
.zs-qs-desc code { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: var(--zs-accent-2); background: rgba(16,185,129,0.1); padding: 1px 5px; border-radius: 3px; }
.zs-code-block-sm { background: #2d353b; border: 1px solid var(--zs-border); border-radius: 10px; overflow: hidden; margin-bottom: 10px; }
.zs-code-block-sm pre { padding: 12px 16px; margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: #d3c6aa; overflow-x: auto; }
.zs-code-block-sm pre code { font-family: inherit; }

@media (max-width: 960px) {
  .zs-api-inner { grid-template-columns: 1fr; gap: 48px; }
  .zs-arch-diagram { flex-direction: column; }
  .zs-arch-arrow-col { flex-direction: row; padding: 8px 0; }
  .zs-qs-grid { grid-template-columns: 1fr; }
}
</style>
