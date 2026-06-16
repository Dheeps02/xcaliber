<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const heroCanvas = ref(null)
let raf = null

const waveTraces = [
  { yFrac: 0.26, amp: 28, freq: 0.013, spd: 1.0,  phase: 0.0, color: '#a78bfa', alpha: 0.34, lw: 1.5 },
  { yFrac: 0.44, amp: 19, freq: 0.018, spd: 1.45, phase: 1.6, color: '#c4b5fd', alpha: 0.20, lw: 1.2 },
  { yFrac: 0.62, amp: 32, freq: 0.009, spd: 0.75, phase: 2.8, color: '#8b5cf6', alpha: 0.18, lw: 1.1 },
  { yFrac: 0.80, amp: 13, freq: 0.023, spd: 1.8,  phase: 0.5, color: '#ddd6fe', alpha: 0.11, lw: 0.9 },
]

function sizeCanvas(c) {
  const w = c.clientWidth, h = c.clientHeight
  if (!w || !h) return null
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const W = Math.round(w * dpr), H = Math.round(h * dpr)
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H }
  const ctx = c.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w, h }
}

function drawCombo(ctx, w, h, t) {
  ctx.clearRect(0, 0, w, h)
  const sp = 50
  ctx.strokeStyle = 'rgba(139,92,246,0.055)'; ctx.lineWidth = 1
  for (let x = sp; x < w; x += sp) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
  for (let y = sp; y < h; y += sp) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
  const pLen = 110
  for (let ri = 1; ri * sp < h; ri++) {
    const ly = ri * sp, seed = ri * 31
    const spd2 = 55 + (seed % 30), dir = (ri % 3 === 0) ? -1 : 1
    const phase = (seed * 0.618) % 1, range = w + pLen * 2
    const px = dir > 0 ? (((t * spd2 + phase * range) % range) - pLen) : (w - (((t * spd2 + phase * range) % range) - pLen))
    const x0 = Math.max(0, px - pLen), x1 = Math.min(w, px + pLen)
    if (x1 <= x0) continue
    const gH = ctx.createLinearGradient(px - pLen, ly, px + pLen, ly)
    gH.addColorStop(0, 'rgba(167,139,250,0)'); gH.addColorStop(0.44, 'rgba(167,139,250,0.38)')
    gH.addColorStop(0.5, 'rgba(220,200,255,0.60)'); gH.addColorStop(0.56, 'rgba(167,139,250,0.38)')
    gH.addColorStop(1, 'rgba(167,139,250,0)')
    ctx.strokeStyle = gH; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(x0, ly); ctx.lineTo(x1, ly); ctx.stroke()
  }
  for (let ci = 1; ci * sp < w; ci++) {
    const lx = ci * sp, seed = ci * 17 + 500
    const spd2 = 42 + (seed % 28), dir = (ci % 2 === 0) ? -1 : 1
    const phase = (seed * 0.618) % 1, range = h + pLen * 2
    const py = dir > 0 ? (((t * spd2 + phase * range) % range) - pLen) : (h - (((t * spd2 + phase * range) % range) - pLen))
    const y0 = Math.max(0, py - pLen), y1 = Math.min(h, py + pLen)
    if (y1 <= y0) continue
    const gV = ctx.createLinearGradient(lx, py - pLen, lx, py + pLen)
    gV.addColorStop(0, 'rgba(167,139,250,0)'); gV.addColorStop(0.44, 'rgba(167,139,250,0.30)')
    gV.addColorStop(0.5, 'rgba(210,185,255,0.48)'); gV.addColorStop(0.56, 'rgba(167,139,250,0.30)')
    gV.addColorStop(1, 'rgba(167,139,250,0)')
    ctx.strokeStyle = gV; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(lx, y0); ctx.lineTo(lx, y1); ctx.stroke()
  }
  for (const tr of waveTraces) {
    ctx.beginPath()
    for (let x = 0; x <= w; x += 4) {
      const yy = h * tr.yFrac + Math.sin(x * tr.freq + t * tr.spd + tr.phase) * tr.amp + Math.sin(x * tr.freq * 2.4 + t * tr.spd * 1.3) * tr.amp * 0.3
      if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy)
    }
    ctx.globalAlpha = tr.alpha; ctx.strokeStyle = tr.color; ctx.lineWidth = tr.lw
    ctx.shadowColor = tr.color; ctx.shadowBlur = 10; ctx.stroke()
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1
}

function loop() {
  const t = performance.now() / 1000
  const s = sizeCanvas(heroCanvas.value)
  if (s) drawCombo(s.ctx, s.w, s.h, t)
  raf = requestAnimationFrame(loop)
}

onMounted(() => { raf = requestAnimationFrame(loop) })
onUnmounted(() => { if (raf) cancelAnimationFrame(raf) })

function onCopy(e) {
  const btn = e.currentTarget
  const txt = btn.getAttribute('data-copy') || ''
  if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {})
  const lbl = btn.querySelector('[data-lbl]')
  if (lbl) { const orig = lbl.textContent; lbl.textContent = 'Copied'; setTimeout(() => { lbl.textContent = orig }, 1300) }
}
</script>

<template>
  <div class="zs-root">
    <div class="zs-grain" aria-hidden="true"></div>

    <!-- NAV -->
    <nav class="zs-nav">
      <a href="/" class="zs-logo">
        <span class="zs-logo-mark">Z</span>
        <span class="zs-logo-name">zenscope</span>
      </a>
      <div class="zs-nav-links">
        <a href="/guide/getting-started" class="zs-nav-link">Docs</a>
        <a href="/features/daq" class="zs-nav-link">Features</a>
        <a href="/reference/rest-api" class="zs-nav-link">API</a>
        <a href="/reference/contributing" class="zs-nav-link">Contributing</a>
      </div>
      <div class="zs-nav-actions">
        <a href="https://github.com/Dheeps02/xcaliber" target="_blank" rel="noopener" class="zs-star">
          <svg width="15" height="15" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M208.31 75.68A59.78 59.78 0 0 0 202.93 28a8 8 0 0 0-6.93-4a59.75 59.75 0 0 0-48 24h-24a59.75 59.75 0 0 0-48-24a8 8 0 0 0-6.93 4a59.78 59.78 0 0 0-5.38 47.68A58.14 58.14 0 0 0 56 104v8a56.06 56.06 0 0 0 48.44 55.47A39.8 39.8 0 0 0 96 192v8H72a24 24 0 0 1-24-24a40 40 0 0 0-40-40a8 8 0 0 0 0 16a24 24 0 0 1 24 24a40 40 0 0 0 40 40h24v16a8 8 0 0 0 16 0v-40a24 24 0 0 1 48 0v40a8 8 0 0 0 16 0v-40a39.8 39.8 0 0 0-8.44-24.53A56.06 56.06 0 0 0 216 112v-8a58.14 58.14 0 0 0-7.69-28.32Z"/></svg>
          <span>Star on GitHub</span>
        </a>
        <a href="/guide/getting-started" class="zs-btn-download">Download</a>
      </div>
    </nav>

    <!-- HERO -->
    <section class="zs-hero">
      <canvas ref="heroCanvas" class="zs-hero-canvas" aria-hidden="true"></canvas>
      <div class="zs-aurora" data-aurora aria-hidden="true">
        <div class="zs-aurora-blob zs-aurora-blob-1"></div>
        <div class="zs-aurora-blob zs-aurora-blob-2"></div>
        <div class="zs-aurora-blob zs-aurora-blob-3"></div>
      </div>
      <div class="zs-hero-fade" aria-hidden="true"></div>
      <div class="zs-hero-content">
        <a href="https://github.com/Dheeps02/xcaliber" target="_blank" rel="noopener" class="zs-badge">
          <span class="zs-badge-dot" aria-hidden="true"></span>
          Open Source — MIT Licensed
        </a>
        <h1 class="zs-hero-title">Measure. Calibrate.<br><em>Master your ECU.</em></h1>
        <p class="zs-hero-sub">ZenScope is an open-source XCP client for automotive ECU calibration and measurement. Live DAQ, packet tracing, REST API — all in one desktop app.</p>
        <div class="zs-hero-ctas">
          <a href="/guide/getting-started" class="zs-btn-primary">Get Started</a>
          <a href="https://github.com/Dheeps02/xcaliber" target="_blank" rel="noopener" class="zs-btn-ghost">View on GitHub</a>
        </div>
        <div class="zs-quickstart-cmd">
          <span class="zs-prompt">$</span>
          <code class="zs-cmd-text">git clone https://github.com/Dheeps02/xcaliber</code>
          <button class="zs-copy-btn" data-copy="git clone https://github.com/Dheeps02/xcaliber" @click="onCopy" aria-label="Copy">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span data-lbl>Copy</span>
          </button>
        </div>
      </div>
    </section>

    <!-- HERO SCREENSHOT -->
    <section class="zs-showcase">
      <div class="zs-container">
        <div class="zs-window-chrome">
          <div class="zs-window-chrome-bar">
            <span class="zs-chrome-dot"></span>
            <span class="zs-chrome-dot"></span>
            <span class="zs-chrome-dot"></span>
            <span class="zs-chrome-title">ZenScope — DAQ Dashboard</span>
          </div>
          <!-- PLACEHOLDER · IMAGE — replace with: <img src="/media/daq-dashboard.png" alt="DAQ Dashboard"> — recommended 1600×900 -->
          <div class="zs-img-placeholder">
            <div class="zs-placeholder-inner">
              <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              <span>DAQ Dashboard Screenshot</span>
              <span class="zs-placeholder-hint">/media/daq-dashboard.png — 1600×900</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FEATURES -->
    <section class="zs-features">
      <div class="zs-container">
        <div class="zs-section-eyebrow">Features</div>
        <h2 class="zs-section-title">Everything you need for XCP</h2>
        <p class="zs-section-sub">Built for calibration engineers who demand precision and speed.</p>
        <div class="zs-features-grid">

          <div class="zs-feature-card">
            <div class="zs-feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M56,96v64a8,8,0,0,1-16,0V96a8,8,0,0,1,16,0ZM88,24a8,8,0,0,0-8,8V224a8,8,0,0,0,16,0V32A8,8,0,0,0,88,24Zm40,32a8,8,0,0,0-8,8V192a8,8,0,0,0,16,0V64A8,8,0,0,0,128,56Zm40,32a8,8,0,0,0-8,8v64a8,8,0,0,0,16,0V96A8,8,0,0,0,168,88Zm40-16a8,8,0,0,0-8,8v96a8,8,0,0,0,16,0V80A8,8,0,0,0,208,72Z"/></svg>
            </div>
            <h3 class="zs-feature-title">Live DAQ Streaming</h3>
            <p class="zs-feature-desc">Configure DAQ lists, ODTs, and entries, then stream live measurement values from the ECU over SSE — no polling.</p>
          </div>

          <div class="zs-feature-card">
            <div class="zs-feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1-8-8V48a8,8,0,0,1,16,0v94.37L90.73,98a8,8,0,0,1,10.07-.38l58.81,44.11L218.73,90a8,8,0,1,1,10.54,12l-64,56a8,8,0,0,1-10.07.38L96.39,114.29,40,163.63V200H224A8,8,0,0,1,232,208Z"/></svg>
            </div>
            <h3 class="zs-feature-title">Live Sparkline Plots</h3>
            <p class="zs-feature-desc">Per-signal mini charts update in real time as values stream in — at a glance, for every signal in the list.</p>
          </div>

          <div class="zs-feature-card">
            <div class="zs-feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M208,136H48a16,16,0,0,0-16,16v40a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V152A16,16,0,0,0,208,136Zm0,56H48V152H208v40Zm0-144H48A16,16,0,0,0,32,64v40a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V64A16,16,0,0,0,208,48Zm0,56H48V64H208v40Z"/></svg>
            </div>
            <h3 class="zs-feature-title">Full Packet Trace</h3>
            <p class="zs-feature-desc">Complete TX/RX log with hex view, decoded fields, and filtering — every byte sent and received.</p>
          </div>

          <div class="zs-feature-card">
            <div class="zs-feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M237.66,18.34a8,8,0,0,0-11.32,0l-52.4,52.41-5.37-5.38a32.05,32.05,0,0,0-45.26,0L100,88.69l-6.34-6.35A8,8,0,0,0,82.34,93.66L88.69,100,65.37,123.31a32,32,0,0,0,0,45.26l5.38,5.37-52.41,52.4a8,8,0,0,0,11.32,11.32l52.4-52.41,5.37,5.38a32,32,0,0,0,45.26,0L156,167.31l6.34,6.35a8,8,0,0,0,11.32-11.32L167.31,156l23.32-23.31a32,32,0,0,0,0-45.26l-5.38-5.37,52.41-52.4A8,8,0,0,0,237.66,18.34Zm-116.29,161a16,16,0,0,1-22.62,0L76.69,157.25a16,16,0,0,1,0-22.62L100,111.31,144.69,156Zm57.94-57.94L156,144.69,111.31,100l23.32-23.31a16,16,0,0,1,22.62,0l22.06,22A16,16,0,0,1,179.31,121.37Z"/></svg>
            </div>
            <h3 class="zs-feature-title">XCP over Ethernet</h3>
            <p class="zs-feature-desc">UDP &amp; TCP transport with configurable settings and full command support — CONNECT, GET_STATUS, UPLOAD, DOWNLOAD, and raw hex.</p>
          </div>

          <div class="zs-feature-card">
            <div class="zs-feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M128,128a8,8,0,0,1-3,6.25l-40,32a8,8,0,1,1-10-12.5L107.19,128,75,102.25a8,8,0,1,1,10-12.5l40,32A8,8,0,0,1,128,128Zm48,24H136a8,8,0,0,0,0,16h40a8,8,0,0,0,0-16Zm56-96V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56ZM216,200V56H40V200H216Z"/></svg>
            </div>
            <h3 class="zs-feature-title">Custom Commands</h3>
            <p class="zs-feature-desc">Define USER_CMD packets via TOML config with named fields, sent from the Commands tab — no raw hex required.</p>
          </div>

          <div class="zs-feature-card">
            <div class="zs-feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M219.31,72,184,36.69A15.86,15.86,0,0,0,172.69,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V83.31A15.86,15.86,0,0,0,219.31,72ZM168,208H88V152h80Zm40,0H184V152a16,16,0,0,0-16-16H88a16,16,0,0,0-16,16v56H48V48H172.69L208,83.31ZM160,72a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h56A8,8,0,0,1,160,72Z"/></svg>
            </div>
            <h3 class="zs-feature-title">Save &amp; Replay</h3>
            <p class="zs-feature-desc">Export and import <code>.daq</code> files for reusable measurement setups — no rebuilding a DAQ list from scratch each session.</p>
          </div>

          <div class="zs-feature-card">
            <div class="zs-feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M128,24C74.17,24,32,48.6,32,80v96c0,31.4,42.17,56,96,56s96-24.6,96-56V80C224,48.6,181.83,24,128,24Zm80,104c0,9.62-7.88,19.43-21.61,26.92C170.93,163.35,150.19,168,128,168s-42.93-4.65-58.39-13.08C55.88,147.43,48,137.62,48,128V111.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64ZM69.61,53.08C85.07,44.65,105.81,40,128,40s42.93,4.65,58.39,13.08C200.12,60.57,208,70.38,208,80s-7.88,19.43-21.61,26.92C170.93,115.35,150.19,120,128,120s-42.93-4.65-58.39-13.08C55.88,99.43,48,89.62,48,80S55.88,60.57,69.61,53.08ZM186.39,202.92C170.93,211.35,150.19,216,128,216s-42.93-4.65-58.39-13.08C55.88,195.43,48,185.62,48,176V159.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64V176C208,185.62,200.12,195.43,186.39,202.92Z"/></svg>
            </div>
            <h3 class="zs-feature-title">SQLite Packet History</h3>
            <p class="zs-feature-desc">Every packet persisted as it happens — restart the app and your trace and DAQ history are still there.</p>
          </div>

          <div class="zs-feature-card">
            <div class="zs-feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M200.77,53.89A103.27,103.27,0,0,0,128,24h-1.07A104,104,0,0,0,24,128c0,43,26.58,79.06,69.36,94.17A32,32,0,0,0,136,192a16,16,0,0,1,16-16h46.21a31.81,31.81,0,0,0,31.2-24.88,104.43,104.43,0,0,0,2.59-24A103.28,103.28,0,0,0,200.77,53.89Zm13,93.71A15.89,15.89,0,0,1,198.21,160H152a32,32,0,0,0-32,32,16,16,0,0,1-21.31,15.07C62.49,194.3,40,164,40,128a88,88,0,0,1,87.09-88h.9a88.35,88.35,0,0,1,88,87.25A88.86,88.86,0,0,1,213.81,147.6ZM140,76a12,12,0,1,1-12-12A12,12,0,0,1,140,76ZM96,100A12,12,0,1,1,84,88,12,12,0,0,1,96,100Zm0,56a12,12,0,1,1-12-12A12,12,0,0,1,96,156Zm88-56a12,12,0,1,1-12-12A12,12,0,0,1,184,100Z"/></svg>
            </div>
            <h3 class="zs-feature-title">10+ Themes</h3>
            <p class="zs-feature-desc">Nord, Catppuccin, Gruvbox, Everforest, OLED, and more — pick the one that matches your setup and switch instantly.</p>
          </div>

          <div class="zs-feature-card">
            <div class="zs-feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="22" height="22"><path d="M215.79,118.17a8,8,0,0,0-5-5.66L153.18,90.9l14.66-73.33a8,8,0,0,0-13.69-7l-112,120a8,8,0,0,0,3,13l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l112-120A8,8,0,0,0,215.79,118.17ZM109.37,214l10.47-52.38a8,8,0,0,0-5-9.06L62,132.71l84.62-90.66L136.16,94.43a8,8,0,0,0,5,9.06l52.8,19.8Z"/></svg>
            </div>
            <h3 class="zs-feature-title">Real-Time Push</h3>
            <p class="zs-feature-desc">SSE-based live push for packets and DTOs — the UI reflects the wire as it happens, not on a timer.</p>
          </div>

        </div>
      </div>
    </section>

    <!-- TRACE SHOWCASE -->
    <section class="zs-showcase-split">
      <div class="zs-container zs-showcase-split-inner">
        <div class="zs-showcase-copy">
          <div class="zs-section-eyebrow">Packet Trace</div>
          <h2 class="zs-section-title">See every XCP frame</h2>
          <p class="zs-section-sub">Real-time capture with colour-coded frame types, hex decode, and timeline filtering. Every byte, always there.</p>
          <a href="/features/trace" class="zs-btn-primary zs-btn-sm">Explore Trace →</a>
        </div>
        <div class="zs-window-chrome zs-window-chrome-side">
          <div class="zs-window-chrome-bar">
            <span class="zs-chrome-dot"></span>
            <span class="zs-chrome-dot"></span>
            <span class="zs-chrome-dot"></span>
            <span class="zs-chrome-title">ZenScope — XCP Trace</span>
          </div>
          <!-- PLACEHOLDER · IMAGE — replace with: <img src="/media/trace.png" alt="XCP Trace view"> — recommended 1200×800 -->
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

    <!-- ARCHITECTURE -->
    <section class="zs-arch">
      <div class="zs-container">
        <div class="zs-section-eyebrow">Architecture</div>
        <h2 class="zs-section-title">Built different</h2>
        <p class="zs-section-sub">A native Rust XCP engine runs as a sidecar alongside the Electron shell — zero compromises on performance or hardware access.</p>
        <div class="zs-arch-diagram">
          <div class="zs-arch-col">
            <div class="zs-arch-box zs-arch-box-ui">
              <span class="zs-arch-label">Electron Shell</span>
              <div class="zs-arch-sub">React + TypeScript</div>
              <div class="zs-arch-pills">
                <span class="zs-pill">DAQ View</span>
                <span class="zs-pill">Trace View</span>
                <span class="zs-pill">Command Bar</span>
              </div>
            </div>
          </div>
          <div class="zs-arch-arrow">
            <svg width="36" height="14" fill="none" viewBox="0 0 36 14" aria-hidden="true"><path d="M0 7h32M26 1l6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="zs-arch-arrow-label">IPC / REST</span>
          </div>
          <div class="zs-arch-col">
            <div class="zs-arch-box zs-arch-box-core">
              <span class="zs-arch-label">ZenScope Core</span>
              <div class="zs-arch-sub">Rust sidecar binary</div>
              <div class="zs-arch-pills">
                <span class="zs-pill">XCP Engine</span>
                <span class="zs-pill">REST API</span>
                <span class="zs-pill">DAQ Scheduler</span>
              </div>
            </div>
          </div>
          <div class="zs-arch-arrow">
            <svg width="36" height="14" fill="none" viewBox="0 0 36 14" aria-hidden="true"><path d="M0 7h32M26 1l6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="zs-arch-arrow-label">XCP/UDP/TCP</span>
          </div>
          <div class="zs-arch-col">
            <div class="zs-arch-box zs-arch-box-ecu">
              <span class="zs-arch-label">Target ECU</span>
              <div class="zs-arch-sub">XCP Slave device</div>
              <div class="zs-arch-pills">
                <span class="zs-pill">CAN / CAN-FD</span>
                <span class="zs-pill">Ethernet</span>
              </div>
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
            <div class="zs-section-eyebrow">REST API</div>
            <h2 class="zs-section-title">Automate everything</h2>
            <p class="zs-section-sub">A full HTTP API ships with every install. Integrate ZenScope into test benches, CI pipelines, and custom tooling without touching the UI.</p>
            <table class="zs-api-table">
              <thead>
                <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr><td><span class="zs-method zs-get">GET</span></td><td><code>/api/daq/status</code></td><td>Session status &amp; sample rate</td></tr>
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

    <!-- THEMES MARQUEE -->
    <section class="zs-themes">
      <div class="zs-container zs-themes-header">
        <div class="zs-section-eyebrow">Themes</div>
        <h2 class="zs-section-title">Your workspace, your aesthetic</h2>
      </div>
      <div class="zs-marquee-wrap">
        <div class="zs-marquee" aria-label="Available themes: Nord, Catppuccin Mocha, Gruvbox Dark, Tokyo Night, Dracula, One Dark, Everforest, Rosé Pine, Monokai, OLED">
          <span class="zs-theme-chip" aria-hidden="true">Nord</span>
          <span class="zs-theme-chip" aria-hidden="true">Catppuccin Mocha</span>
          <span class="zs-theme-chip" aria-hidden="true">Gruvbox Dark</span>
          <span class="zs-theme-chip" aria-hidden="true">Tokyo Night</span>
          <span class="zs-theme-chip" aria-hidden="true">Dracula</span>
          <span class="zs-theme-chip" aria-hidden="true">One Dark</span>
          <span class="zs-theme-chip" aria-hidden="true">Everforest</span>
          <span class="zs-theme-chip" aria-hidden="true">Rosé Pine</span>
          <span class="zs-theme-chip" aria-hidden="true">Monokai</span>
          <span class="zs-theme-chip" aria-hidden="true">OLED</span>
          <!-- duplicated for seamless loop -->
          <span class="zs-theme-chip" aria-hidden="true">Nord</span>
          <span class="zs-theme-chip" aria-hidden="true">Catppuccin Mocha</span>
          <span class="zs-theme-chip" aria-hidden="true">Gruvbox Dark</span>
          <span class="zs-theme-chip" aria-hidden="true">Tokyo Night</span>
          <span class="zs-theme-chip" aria-hidden="true">Dracula</span>
          <span class="zs-theme-chip" aria-hidden="true">One Dark</span>
          <span class="zs-theme-chip" aria-hidden="true">Everforest</span>
          <span class="zs-theme-chip" aria-hidden="true">Rosé Pine</span>
          <span class="zs-theme-chip" aria-hidden="true">Monokai</span>
          <span class="zs-theme-chip" aria-hidden="true">OLED</span>
        </div>
      </div>
    </section>

    <!-- QUICKSTART -->
    <section class="zs-quickstart">
      <div class="zs-container">
        <div class="zs-section-eyebrow">Quickstart</div>
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
            <p class="zs-qs-desc">Electron + Vite dev server start together. Hot reload is active on the frontend.</p>
          </div>
          <div class="zs-qs-step">
            <div class="zs-qs-num">03</div>
            <h3 class="zs-qs-title">Connect &amp; Measure</h3>
            <p class="zs-qs-desc">Point ZenScope at your XCP target (or the bundled mock slave at <code>127.0.0.1:5555</code>) and start a DAQ session. No ECU required to get started.</p>
            <a href="/guide/getting-started" class="zs-link-underline">Full getting-started guide →</a>
          </div>
        </div>
      </div>
    </section>

    <!-- BUILT FOR -->
    <section class="zs-built-for">
      <div class="zs-container">
        <div class="zs-section-eyebrow">Built For</div>
        <h2 class="zs-section-title">Who uses ZenScope?</h2>
        <div class="zs-bf-grid">
          <div class="zs-bf-card">
            <div class="zs-bf-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="26" height="26"><path d="M56,96v64a8,8,0,0,1-16,0V96a8,8,0,0,1,16,0ZM88,24a8,8,0,0,0-8,8V224a8,8,0,0,0,16,0V32A8,8,0,0,0,88,24Zm40,32a8,8,0,0,0-8,8V192a8,8,0,0,0,16,0V64A8,8,0,0,0,128,56Zm40,32a8,8,0,0,0-8,8v64a8,8,0,0,0,16,0V96A8,8,0,0,0,168,88Zm40-16a8,8,0,0,0-8,8v96a8,8,0,0,0,16,0V80A8,8,0,0,0,208,72Z"/></svg>
            </div>
            <h3>Calibration Engineers</h3>
            <p>Read and write ECU maps, monitor live signals, and iterate calibrations without switching tools. Runs on the bench and on the dyno.</p>
          </div>
          <div class="zs-bf-card">
            <div class="zs-bf-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="26" height="26"><path d="M128,128a8,8,0,0,1-3,6.25l-40,32a8,8,0,1,1-10-12.5L107.19,128,75,102.25a8,8,0,1,1,10-12.5l40,32A8,8,0,0,1,128,128Zm48,24H136a8,8,0,0,0,0,16h40a8,8,0,0,0,0-16Zm56-96V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56ZM216,200V56H40V200H216Z"/></svg>
            </div>
            <h3>Test Automation</h3>
            <p>Drive measurements and calibrations from CI pipelines using the REST API. Script connect, DAQ, and disconnect — no GUI required.</p>
          </div>
          <div class="zs-bf-card">
            <div class="zs-bf-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="26" height="26"><path d="M208,136H48a16,16,0,0,0-16,16v40a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V152A16,16,0,0,0,208,136Zm0,56H48V152H208v40Zm0-144H48A16,16,0,0,0,32,64v40a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V64A16,16,0,0,0,208,48Zm0,56H48V64H208v40Z"/></svg>
            </div>
            <h3>Reverse Engineering</h3>
            <p>Inspect raw XCP frames, trace undocumented memory regions, and build a picture of unknown ECU internals — every byte visible.</p>
          </div>
        </div>
        <a href="/guide/use-cases" class="zs-link-underline">Read the use-case guide →</a>
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
          <span class="zs-stack-pill">XCP Protocol</span>
          <span class="zs-stack-pill">Server-Sent Events</span>
        </div>
        <a href="/reference/architecture" class="zs-link-underline">Architecture overview →</a>
      </div>
    </section>

    <!-- CTA -->
    <section class="zs-cta">
      <div class="zs-container">
        <div class="zs-cta-inner">
          <div class="zs-cta-aurora" data-aurora aria-hidden="true">
            <div class="zs-aurora-blob zs-aurora-blob-1"></div>
            <div class="zs-aurora-blob zs-aurora-blob-2"></div>
          </div>
          <h2 class="zs-cta-title">Ready to scope your ECU?</h2>
          <p class="zs-cta-sub">Free, open-source, and MIT licensed. No login. No telemetry. Just you and your ECU.</p>
          <div class="zs-cta-btns">
            <a href="/guide/getting-started" class="zs-btn-primary">Get Started</a>
            <a href="https://github.com/Dheeps02/xcaliber" target="_blank" rel="noopener" class="zs-btn-ghost">
              <svg width="15" height="15" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M208.31 75.68A59.78 59.78 0 0 0 202.93 28a8 8 0 0 0-6.93-4a59.75 59.75 0 0 0-48 24h-24a59.75 59.75 0 0 0-48-24a8 8 0 0 0-6.93 4a59.78 59.78 0 0 0-5.38 47.68A58.14 58.14 0 0 0 56 104v8a56.06 56.06 0 0 0 48.44 55.47A39.8 39.8 0 0 0 96 192v8H72a24 24 0 0 1-24-24a40 40 0 0 0-40-40a8 8 0 0 0 0 16a24 24 0 0 1 24 24a40 40 0 0 0 40 40h24v16a8 8 0 0 0 16 0v-40a24 24 0 0 1 48 0v40a8 8 0 0 0 16 0v-40a39.8 39.8 0 0 0-8.44-24.53A56.06 56.06 0 0 0 216 112v-8a58.14 58.14 0 0 0-7.69-28.32Z"/></svg>
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="zs-footer">
      <div class="zs-container">
        <div class="zs-footer-grid">
          <div class="zs-footer-brand">
            <a href="/" class="zs-logo">
              <span class="zs-logo-mark">Z</span>
              <span class="zs-logo-name">zenscope</span>
            </a>
            <p class="zs-footer-tagline">Open-source XCP client for automotive ECU calibration and measurement.</p>
            <div class="zs-footer-social">
              <a href="https://github.com/Dheeps02/xcaliber" target="_blank" rel="noopener" class="zs-footer-icon" aria-label="GitHub">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M208.31 75.68A59.78 59.78 0 0 0 202.93 28a8 8 0 0 0-6.93-4a59.75 59.75 0 0 0-48 24h-24a59.75 59.75 0 0 0-48-24a8 8 0 0 0-6.93 4a59.78 59.78 0 0 0-5.38 47.68A58.14 58.14 0 0 0 56 104v8a56.06 56.06 0 0 0 48.44 55.47A39.8 39.8 0 0 0 96 192v8H72a24 24 0 0 1-24-24a40 40 0 0 0-40-40a8 8 0 0 0 0 16a24 24 0 0 1 24 24a40 40 0 0 0 40 40h24v16a8 8 0 0 0 16 0v-40a24 24 0 0 1 48 0v40a8 8 0 0 0 16 0v-40a39.8 39.8 0 0 0-8.44-24.53A56.06 56.06 0 0 0 216 112v-8a58.14 58.14 0 0 0-7.69-28.32Z"/></svg>
              </a>
            </div>
          </div>
          <div class="zs-footer-col">
            <h4 class="zs-footer-col-title">Docs</h4>
            <a href="/guide/getting-started" class="zs-footer-link">Getting Started</a>
            <a href="/guide/configuration" class="zs-footer-link">Configuration</a>
            <a href="/guide/use-cases" class="zs-footer-link">Use Cases</a>
          </div>
          <div class="zs-footer-col">
            <h4 class="zs-footer-col-title">Features</h4>
            <a href="/features/daq" class="zs-footer-link">Live DAQ</a>
            <a href="/features/trace" class="zs-footer-link">XCP Trace</a>
            <a href="/reference/rest-api" class="zs-footer-link">REST API</a>
          </div>
          <div class="zs-footer-col">
            <h4 class="zs-footer-col-title">Project</h4>
            <a href="https://github.com/Dheeps02/xcaliber" target="_blank" rel="noopener" class="zs-footer-link">GitHub</a>
            <a href="https://github.com/Dheeps02/xcaliber/issues" target="_blank" rel="noopener" class="zs-footer-link">Issues</a>
            <a href="/reference/contributing" class="zs-footer-link">Contributing</a>
            <a href="https://www.asam.net/standards/detail/mcd-1-xcp/" target="_blank" rel="noopener" class="zs-footer-link">XCP Spec ↗</a>
          </div>
        </div>
        <div class="zs-footer-bottom">
          <span class="zs-footer-copy">© 2026 ZenScope. MIT License.</span>
          <span class="zs-footer-copy">Built for automotive engineers.</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Root ── */
.zs-root {
  --zs-accent: #8b5cf6;
  --zs-accent-2: color-mix(in oklab, var(--zs-accent), white 32%);
  --zs-accent-3: color-mix(in oklab, var(--zs-accent), black 26%);
  --zs-aurora-op: 0.55;
  --zs-text: #ECEAF3;
  --zs-muted: #9b94ad;
  --zs-faint: #6a6380;
  --zs-border: rgba(255,255,255,0.09);
  --zs-panel: #141220;

  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  background: radial-gradient(1200px 700px at 80% -10%, rgba(139,92,246,0.10), transparent 60%), #0a0810;
  color: var(--zs-text);
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
}

/* ── Grain ── */
.zs-grain {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.04;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ── Container ── */
.zs-container {
  max-width: 1160px;
  margin: 0 auto;
  padding: 0 32px;
}

/* ── Nav ── */
.zs-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 0 40px;
  height: 64px;
  background: rgba(10,8,16,0.80);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--zs-border);
}

.zs-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  flex-shrink: 0;
}

.zs-logo-mark {
  width: 30px;
  height: 30px;
  background: var(--zs-accent);
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
  color: #fff;
}

.zs-logo-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  letter-spacing: -0.02em;
  color: var(--zs-text);
  font-weight: 500;
}

.zs-nav-links {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.zs-nav-link {
  font-size: 14px;
  color: var(--zs-muted);
  text-decoration: none;
  padding: 6px 12px;
  border-radius: 6px;
  transition: color 0.15s;
}
.zs-nav-link:hover { color: var(--zs-text); }

.zs-nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.zs-star {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: var(--zs-muted);
  text-decoration: none;
  padding: 6px 14px;
  border: 1px solid var(--zs-border);
  border-radius: 8px;
  transition: border-color 0.15s, color 0.15s;
}
.zs-star:hover { border-color: rgba(139,92,246,0.55); color: #fff; }

.zs-btn-download {
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  background: var(--zs-accent);
  text-decoration: none;
  padding: 7px 16px;
  border-radius: 8px;
  transition: box-shadow 0.2s;
}
.zs-btn-download:hover { box-shadow: 0 9px 30px rgba(139,92,246,0.5); }

/* ── Hero ── */
.zs-hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: hidden;
  isolation: isolate;
}

.zs-hero-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.zs-aurora {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
}

.zs-aurora-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
}

.zs-aurora-blob-1 {
  width: 65vw;
  height: 55vh;
  top: -15%;
  left: -10%;
  background: radial-gradient(ellipse, rgba(139,92,246,var(--zs-aurora-op)), transparent 70%);
  animation: zs-drift1 24s ease-in-out infinite;
}

.zs-aurora-blob-2 {
  width: 55vw;
  height: 50vh;
  top: 5%;
  right: -15%;
  background: radial-gradient(ellipse, rgba(109,40,217,calc(var(--zs-aurora-op) * 0.75)), transparent 70%);
  animation: zs-drift2 30s ease-in-out infinite;
}

.zs-aurora-blob-3 {
  width: 45vw;
  height: 40vh;
  bottom: -10%;
  left: 25%;
  background: radial-gradient(ellipse, rgba(167,139,250,calc(var(--zs-aurora-op) * 0.45)), transparent 70%);
  animation: zs-drift3 20s ease-in-out infinite;
}

.zs-hero-fade {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 300px;
  background: linear-gradient(to bottom, transparent, #0a0810);
  z-index: 2;
  pointer-events: none;
}

.zs-hero-content {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  max-width: 800px;
  padding: 0 24px;
}

.zs-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--zs-accent-2);
  background: rgba(139,92,246,0.12);
  border: 1px solid rgba(139,92,246,0.3);
  border-radius: 999px;
  padding: 6px 16px;
  text-decoration: none;
  letter-spacing: 0.02em;
  animation: zs-fadeup 0.7s ease both;
}

.zs-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--zs-accent);
  flex-shrink: 0;
  animation: zs-blink 2s ease-in-out infinite;
}

.zs-hero-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(52px, 8vw, 96px);
  font-weight: 500;
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: var(--zs-text);
  animation: zs-fadeup 0.7s 0.1s ease both;
}

.zs-hero-title em {
  font-style: italic;
  color: var(--zs-accent-2);
}

.zs-hero-sub {
  font-size: 18px;
  line-height: 1.65;
  color: var(--zs-muted);
  max-width: 560px;
  animation: zs-fadeup 0.7s 0.2s ease both;
}

.zs-hero-ctas {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: center;
  animation: zs-fadeup 0.7s 0.3s ease both;
}

.zs-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 500;
  color: #fff;
  background: var(--zs-accent);
  text-decoration: none;
  padding: 12px 28px;
  border-radius: 10px;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 6px 24px rgba(139,92,246,0.35);
}
.zs-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 14px 42px rgba(139,92,246,0.55); }

.zs-btn-sm { padding: 9px 20px; font-size: 14px; }

.zs-btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 500;
  color: var(--zs-muted);
  background: transparent;
  text-decoration: none;
  padding: 11px 28px;
  border-radius: 10px;
  border: 1px solid var(--zs-border);
  transition: border-color 0.2s, color 0.2s;
}
.zs-btn-ghost:hover { border-color: rgba(139,92,246,0.5); color: #fff; }

.zs-quickstart-cmd {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--zs-muted);
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--zs-border);
  border-radius: 10px;
  padding: 10px 16px;
  animation: zs-fadeup 0.7s 0.4s ease both;
}

.zs-prompt { color: var(--zs-accent-2); }
.zs-cmd-text { color: var(--zs-text); }

.zs-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--zs-faint);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 5px;
  padding: 3px 8px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.zs-copy-btn:hover { border-color: rgba(139,92,246,0.5); color: #fff; }

/* ── Showcase ── */
.zs-showcase {
  padding: 0 0 100px;
}

.zs-showcase-split {
  padding: 80px 0 100px;
  border-top: 1px solid var(--zs-border);
}

.zs-showcase-split-inner {
  display: flex;
  gap: 64px;
  align-items: center;
}

.zs-showcase-copy { flex: 1; min-width: 0; }
.zs-showcase-copy .zs-section-title { margin-top: 8px; margin-bottom: 14px; }
.zs-showcase-copy .zs-section-sub { margin-bottom: 24px; max-width: 400px; }

.zs-window-chrome {
  background: var(--zs-panel);
  border: 1px solid var(--zs-border);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 32px 80px rgba(0,0,0,0.5);
}

.zs-window-chrome-side { flex: 1.5; }

.zs-window-chrome-bar {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 12px 16px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid var(--zs-border);
}

.zs-chrome-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(255,255,255,0.12);
  flex-shrink: 0;
}

.zs-chrome-title {
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--zs-faint);
  margin-left: 8px;
}

.zs-img-placeholder {
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.02);
}

.zs-placeholder-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--zs-faint);
  font-size: 14px;
}

.zs-placeholder-hint {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--zs-faint);
  opacity: 0.55;
}

/* ── Section common ── */
.zs-section-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--zs-accent-2);
  margin-bottom: 12px;
}

.zs-section-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(32px, 4vw, 54px);
  font-weight: 500;
  letter-spacing: -0.025em;
  line-height: 1.1;
  color: var(--zs-text);
  margin-bottom: 16px;
}

.zs-section-sub {
  font-size: 17px;
  line-height: 1.65;
  color: var(--zs-muted);
  max-width: 580px;
  margin-bottom: 52px;
}

/* ── Features ── */
.zs-features {
  padding: 100px 0;
  border-top: 1px solid var(--zs-border);
}

.zs-features .zs-container { text-align: center; }
.zs-features .zs-section-sub { margin: 0 auto 52px; }

.zs-features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  text-align: left;
}

.zs-feature-card {
  background: var(--zs-panel);
  border: 1px solid var(--zs-border);
  border-radius: 14px;
  padding: 28px;
  transition: border-color 0.2s, transform 0.2s;
}
.zs-feature-card:hover { border-color: rgba(139,92,246,0.45); transform: translateY(-3px); }

.zs-feature-icon {
  width: 44px;
  height: 44px;
  background: rgba(139,92,246,0.12);
  border: 1px solid rgba(139,92,246,0.2);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--zs-accent-2);
  margin-bottom: 16px;
}

.zs-feature-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--zs-text);
  margin-bottom: 8px;
  letter-spacing: -0.01em;
}

.zs-feature-desc {
  font-size: 14px;
  line-height: 1.65;
  color: var(--zs-muted);
}

.zs-feature-desc code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  color: var(--zs-accent-2);
  background: rgba(139,92,246,0.1);
  padding: 1px 5px;
  border-radius: 3px;
}

/* ── Architecture ── */
.zs-arch {
  padding: 100px 0;
  border-top: 1px solid var(--zs-border);
}

.zs-arch-diagram {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 52px 0 32px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.zs-arch-col { flex: 1; min-width: 180px; }

.zs-arch-box {
  border: 1px solid var(--zs-border);
  border-radius: 14px;
  padding: 24px;
  background: var(--zs-panel);
}
.zs-arch-box-ui { border-color: rgba(139,92,246,0.3); }
.zs-arch-box-core { border-color: rgba(139,92,246,0.55); background: rgba(139,92,246,0.06); }
.zs-arch-box-ecu { border-color: rgba(139,92,246,0.2); }

.zs-arch-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--zs-text);
  margin-bottom: 4px;
}

.zs-arch-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--zs-faint);
  margin-bottom: 14px;
}

.zs-arch-pills { display: flex; flex-wrap: wrap; gap: 6px; }

.zs-pill {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  color: var(--zs-accent-2);
  background: rgba(139,92,246,0.1);
  border: 1px solid rgba(139,92,246,0.18);
  border-radius: 4px;
  padding: 3px 8px;
}

.zs-arch-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  color: var(--zs-faint);
  flex-shrink: 0;
}

.zs-arch-arrow-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--zs-faint);
  white-space: nowrap;
}

.zs-link-underline {
  font-size: 14px;
  color: var(--zs-accent-2);
  text-decoration: none;
  border-bottom: 1px solid rgba(139,92,246,0.35);
  padding-bottom: 1px;
  transition: color 0.15s, border-color 0.15s;
}
.zs-link-underline:hover { color: #fff; border-color: rgba(139,92,246,0.7); }

/* ── API ── */
.zs-api {
  padding: 100px 0;
  border-top: 1px solid var(--zs-border);
}

.zs-api-inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
  align-items: start;
}

.zs-api-copy .zs-section-sub { margin-bottom: 24px; }

.zs-api-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-bottom: 24px;
}

.zs-api-table th {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--zs-faint);
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--zs-border);
}

.zs-api-table td {
  padding: 10px 12px;
  color: var(--zs-muted);
  border-bottom: 1px solid rgba(255,255,255,0.04);
  vertical-align: middle;
  font-size: 13px;
}

.zs-api-table td code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--zs-text);
}

.zs-method {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 7px;
  border-radius: 4px;
  white-space: nowrap;
}
.zs-get { background: rgba(34,197,94,0.12); color: #4ade80; }
.zs-post { background: rgba(139,92,246,0.15); color: var(--zs-accent-2); }

.zs-api-code-block {
  background: var(--zs-panel);
  border: 1px solid var(--zs-border);
  border-radius: 12px;
  overflow: hidden;
}

.zs-code-block-sm {
  background: var(--zs-panel);
  border: 1px solid var(--zs-border);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 10px;
}

.zs-code-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid var(--zs-border);
}

.zs-code-lang {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--zs-faint);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.zs-code {
  padding: 20px;
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.75;
  overflow-x: auto;
  color: var(--zs-muted);
}

.zs-code-block-sm pre {
  padding: 12px 16px;
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  color: var(--zs-text);
  overflow-x: auto;
}

.zs-code-block-sm pre code { font-family: inherit; }

.zs-c-dim { color: var(--zs-faint); }
.zs-c-str { color: #a78bfa; }

/* ── Themes marquee ── */
.zs-themes {
  padding: 80px 0;
  border-top: 1px solid var(--zs-border);
  overflow: hidden;
}

.zs-themes-header { text-align: center; margin-bottom: 40px; }
.zs-themes-header .zs-section-title { margin-bottom: 0; }

.zs-marquee-wrap {
  overflow: hidden;
  mask: linear-gradient(to right, transparent, black 12%, black 88%, transparent);
  -webkit-mask: linear-gradient(to right, transparent, black 12%, black 88%, transparent);
}

.zs-marquee {
  display: flex;
  width: max-content;
  animation: zs-marquee 30s linear infinite;
}
.zs-marquee:hover { animation-play-state: paused; }

.zs-theme-chip {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--zs-muted);
  background: var(--zs-panel);
  border: 1px solid var(--zs-border);
  border-radius: 8px;
  padding: 9px 22px;
  margin: 0 8px;
  white-space: nowrap;
  user-select: none;
}

/* ── Quickstart ── */
.zs-quickstart {
  padding: 100px 0;
  border-top: 1px solid var(--zs-border);
}

.zs-qs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 48px;
  margin-top: 52px;
}

.zs-qs-num {
  font-family: 'Cormorant Garamond', serif;
  font-size: 56px;
  font-weight: 500;
  color: rgba(139,92,246,0.22);
  line-height: 1;
  margin-bottom: 14px;
}

.zs-qs-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--zs-text);
  margin-bottom: 16px;
  letter-spacing: -0.01em;
}

.zs-qs-desc {
  font-size: 15px;
  line-height: 1.65;
  color: var(--zs-muted);
  margin-bottom: 16px;
}

.zs-qs-desc code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  color: var(--zs-accent-2);
  background: rgba(139,92,246,0.1);
  padding: 1px 5px;
  border-radius: 3px;
}

/* ── Built For ── */
.zs-built-for {
  padding: 100px 0;
  border-top: 1px solid var(--zs-border);
}

.zs-bf-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin: 52px 0 32px;
}

.zs-bf-card {
  background: var(--zs-panel);
  border: 1px solid var(--zs-border);
  border-radius: 14px;
  padding: 32px;
}

.zs-bf-icon {
  width: 52px;
  height: 52px;
  background: rgba(139,92,246,0.1);
  border: 1px solid rgba(139,92,246,0.2);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--zs-accent-2);
  margin-bottom: 18px;
}

.zs-bf-card h3 {
  font-size: 17px;
  font-weight: 600;
  color: var(--zs-text);
  margin-bottom: 10px;
  letter-spacing: -0.01em;
}

.zs-bf-card p {
  font-size: 14px;
  line-height: 1.65;
  color: var(--zs-muted);
}

/* ── Tech Stack ── */
.zs-stack {
  padding: 80px 0;
  border-top: 1px solid var(--zs-border);
}

.zs-stack-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 28px 0 24px;
}

.zs-stack-pill {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--zs-muted);
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--zs-border);
  border-radius: 7px;
  padding: 7px 16px;
}

/* ── CTA ── */
.zs-cta {
  padding: 120px 0;
  border-top: 1px solid var(--zs-border);
}

.zs-cta-inner {
  position: relative;
  text-align: center;
  isolation: isolate;
  padding: 80px 40px;
  border: 1px solid rgba(139,92,246,0.2);
  border-radius: 24px;
  overflow: hidden;
}

.zs-cta-aurora {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.zs-cta-aurora .zs-aurora-blob-1 {
  width: 60%;
  height: 80%;
  top: -20%;
  left: -10%;
  opacity: 0.5;
}

.zs-cta-aurora .zs-aurora-blob-2 {
  width: 50%;
  height: 70%;
  top: -10%;
  right: -10%;
  opacity: 0.4;
}

.zs-cta-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(36px, 5vw, 64px);
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--zs-text);
  margin-bottom: 16px;
}

.zs-cta-sub {
  font-size: 17px;
  color: var(--zs-muted);
  margin: 0 auto 36px;
  max-width: 480px;
}

.zs-cta-btns {
  display: flex;
  align-items: center;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
}

/* ── Footer ── */
.zs-footer {
  padding: 60px 0 40px;
  border-top: 1px solid var(--zs-border);
}

.zs-footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 48px;
  margin-bottom: 48px;
}

.zs-footer-tagline {
  font-size: 14px;
  line-height: 1.65;
  color: var(--zs-faint);
  margin-top: 14px;
  max-width: 260px;
}

.zs-footer-social {
  margin-top: 18px;
  display: flex;
  gap: 10px;
}

.zs-footer-icon {
  color: var(--zs-faint);
  text-decoration: none;
  transition: color 0.15s;
}
.zs-footer-icon:hover { color: var(--zs-text); }

.zs-footer-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.zs-footer-col-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--zs-muted);
  margin-bottom: 4px;
}

.zs-footer-link {
  font-size: 14px;
  color: var(--zs-faint);
  text-decoration: none;
  transition: color 0.15s;
}
.zs-footer-link:hover { color: var(--zs-accent-2); }

.zs-footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 24px;
  border-top: 1px solid var(--zs-border);
}

.zs-footer-copy {
  font-size: 13px;
  color: var(--zs-faint);
}

/* ── Keyframes ── */
@keyframes zs-drift1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(7vw, 4vh) scale(1.18); }
}

@keyframes zs-drift2 {
  0%, 100% { transform: translate(0, 0) scale(1.05); }
  50% { transform: translate(-6vw, 5vh) scale(1.2); }
}

@keyframes zs-drift3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(4vw, -5vh) scale(1.22); }
}

@keyframes zs-fadeup {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes zs-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

@keyframes zs-marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

@media (prefers-reduced-motion: reduce) {
  [data-aurora] > * { animation: none !important; }
  .zs-marquee { animation: none !important; }
  .zs-hero-title, .zs-hero-sub, .zs-hero-ctas, .zs-badge, .zs-quickstart-cmd { animation: none !important; }
}

/* ── Responsive ── */
@media (max-width: 960px) {
  .zs-nav-links { display: none; }
  .zs-features-grid { grid-template-columns: repeat(2, 1fr); }
  .zs-api-inner { grid-template-columns: 1fr; gap: 48px; }
  .zs-showcase-split-inner { flex-direction: column-reverse; }
  .zs-window-chrome-side { width: 100%; flex: none; }
  .zs-arch-diagram { flex-direction: column; align-items: stretch; }
  .zs-arch-arrow { flex-direction: row; justify-content: center; }
  .zs-qs-grid { grid-template-columns: 1fr; }
  .zs-bf-grid { grid-template-columns: 1fr; }
  .zs-footer-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 600px) {
  .zs-features-grid { grid-template-columns: 1fr; }
  .zs-footer-grid { grid-template-columns: 1fr; }
  .zs-nav { padding: 0 20px; }
  .zs-star span { display: none; }
  .zs-cta-inner { padding: 48px 24px; }
  .zs-container { padding: 0 20px; }
}
</style>
