<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const heroCanvas = ref(null)
let raf = null

const waveTraces = [
  { yFrac: 0.26, amp: 28, freq: 0.013, spd: 1.0,  phase: 0.0, color: '#6ee7b7', alpha: 0.34, lw: 1.5 },
  { yFrac: 0.44, amp: 19, freq: 0.018, spd: 1.45, phase: 1.6, color: '#34d399', alpha: 0.20, lw: 1.2 },
  { yFrac: 0.62, amp: 32, freq: 0.009, spd: 0.75, phase: 2.8, color: '#10b981', alpha: 0.18, lw: 1.1 },
  { yFrac: 0.80, amp: 13, freq: 0.023, spd: 1.8,  phase: 0.5, color: '#a7f3d0', alpha: 0.11, lw: 0.9 },
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
  ctx.strokeStyle = 'rgba(16,185,129,0.05)'; ctx.lineWidth = 1
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
    gH.addColorStop(0, 'rgba(52,211,153,0)'); gH.addColorStop(0.44, 'rgba(52,211,153,0.36)')
    gH.addColorStop(0.5, 'rgba(110,231,183,0.58)'); gH.addColorStop(0.56, 'rgba(52,211,153,0.36)')
    gH.addColorStop(1, 'rgba(52,211,153,0)')
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
    gV.addColorStop(0, 'rgba(52,211,153,0)'); gV.addColorStop(0.44, 'rgba(52,211,153,0.28)')
    gV.addColorStop(0.5, 'rgba(110,231,183,0.46)'); gV.addColorStop(0.56, 'rgba(52,211,153,0.28)')
    gV.addColorStop(1, 'rgba(52,211,153,0)')
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
        Open Source — GPL-3.0
      </a>
      <h1 class="zs-hero-title">Calibration,<br><em>without the noise.</em></h1>
      <p class="zs-hero-sub">
        An open-source XCP client for engineers who'd rather tune than configure tools. Built on the <a href="https://www.asam.net/standards/detail/mcd-1-xcp/" target="_blank" rel="noopener" class="zs-hero-xcp-link">ASAM XCP protocol</a> — live DAQ, packet tracing, REST API, all in one desktop app.
      </p>
      <a href="https://www.asam.net/standards/detail/mcd-1-xcp/" target="_blank" rel="noopener" class="zs-xcp-pill">
        <svg width="12" height="12" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm0 192a88 88 0 1 1 88-88 88.1 88.1 0 0 1-88 88Zm16-40a8 8 0 0 1-8 8 16 16 0 0 1-16-16v-40a8 8 0 0 1 0-16 16 16 0 0 1 16 16v40a8 8 0 0 1 8 8ZM112 84a12 12 0 1 1 12 12 12 12 0 0 1-12-12Z"/></svg>
        New to XCP? Read the ASAM spec ↗
      </a>
      <div class="zs-hero-ctas">
        <a href="/guide/getting-started" class="zs-btn-primary">
          <svg width="15" height="15" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M240 136v64a16 16 0 0 1-16 16H32a16 16 0 0 1-16-16v-64a16 16 0 0 1 16-16h48a8 8 0 0 1 0 16H32v64h192v-64h-48a8 8 0 0 1 0-16h48a16 16 0 0 1 16 16Zm-114.34-61.66a8 8 0 0 1 10.68 0l40 40a8 8 0 0 1-11.31 11.31L136 96.69V176a8 8 0 0 1-16 0V96.69l-29.03 29.0a8 8 0 0 1-11.31-11.31Z"/></svg>
          Get Started
        </a>
        <a href="https://github.com/Dheeps02/xcaliber" target="_blank" rel="noopener" class="zs-btn-ghost">
          <svg width="15" height="15" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M208.31 75.68A59.78 59.78 0 0 0 202.93 28a8 8 0 0 0-6.93-4 59.75 59.75 0 0 0-48 24h-24a59.75 59.75 0 0 0-48-24 8 8 0 0 0-6.93 4 59.78 59.78 0 0 0-5.38 47.68A58.14 58.14 0 0 0 56 104v8a56.06 56.06 0 0 0 48.44 55.47A39.8 39.8 0 0 0 96 192v8H72a24 24 0 0 1-24-24 40 40 0 0 0-40-40 8 8 0 0 0 0 16 24 24 0 0 1 24 24 40 40 0 0 0 40 40h24v16a8 8 0 0 0 16 0v-40a24 24 0 0 1 48 0v40a8 8 0 0 0 16 0v-40a39.8 39.8 0 0 0-8.44-24.53A56.06 56.06 0 0 0 216 112v-8a58.14 58.14 0 0 0-7.69-28.32Z"/></svg>
          View on GitHub
        </a>
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

  <!-- DAQ SHOWCASE -->
  <section class="zs-showcase">
    <div class="zs-container">
      <div class="zs-window-chrome">
        <div class="zs-window-chrome-bar">
          <span class="zs-chrome-dot"></span><span class="zs-chrome-dot"></span><span class="zs-chrome-dot"></span>
          <span class="zs-chrome-title">ZenScope — DAQ Dashboard</span>
        </div>
        <!-- replace with: <img src="/media/daq-dashboard.png" alt="DAQ Dashboard"> 1600×900 -->
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
</template>

<style scoped>
.zs-hero {
  position: relative; min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  text-align: center; overflow: hidden; isolation: isolate;
}
.zs-hero-canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; }
.zs-hero-fade {
  position: absolute; bottom: 0; left: 0; right: 0; height: 300px;
  background: linear-gradient(to bottom, transparent, #060c0a); z-index: 2; pointer-events: none;
}
.zs-hero-content {
  position: relative; z-index: 3;
  display: flex; flex-direction: column; align-items: center; gap: 24px;
  max-width: 820px; padding: 0 24px;
}
.zs-badge {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 12.5px; font-family: 'JetBrains Mono', monospace;
  color: var(--zs-accent-2); background: rgba(16,185,129,0.10);
  border: 1px solid rgba(16,185,129,0.28); border-radius: 999px;
  padding: 6px 16px; text-decoration: none; letter-spacing: 0.02em;
  animation: zs-fadeup 0.7s ease both;
}
.zs-badge-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--zs-accent); flex-shrink: 0;
  animation: zs-blink 2s ease-in-out infinite;
}
.zs-hero-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(52px, 8vw, 96px); font-weight: 500;
  line-height: 1.05; letter-spacing: -0.03em; color: var(--zs-text);
  animation: zs-fadeup 0.7s 0.1s ease both;
}
.zs-hero-title em { font-style: italic; color: var(--zs-accent-2); }
.zs-hero-sub {
  font-size: 18px; line-height: 1.65; color: var(--zs-muted);
  max-width: 580px; animation: zs-fadeup 0.7s 0.2s ease both;
}
.zs-hero-xcp-link {
  color: var(--zs-accent-2); text-decoration: none;
  border-bottom: 1px solid rgba(16,185,129,0.4);
  transition: color 0.15s, border-color 0.15s;
}
.zs-hero-xcp-link:hover { color: #fff; border-color: rgba(16,185,129,0.8); }
.zs-xcp-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-family: 'JetBrains Mono', monospace;
  color: var(--zs-faint); background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07); border-radius: 6px;
  padding: 5px 12px; text-decoration: none;
  transition: color 0.15s, border-color 0.15s;
  animation: zs-fadeup 0.7s 0.25s ease both;
}
.zs-xcp-pill:hover { color: var(--zs-accent-2); border-color: rgba(16,185,129,0.3); }
.zs-hero-ctas {
  display: flex; align-items: center; gap: 14px;
  flex-wrap: wrap; justify-content: center;
  animation: zs-fadeup 0.7s 0.3s ease both;
}
.zs-quickstart-cmd {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--zs-muted);
  background: rgba(255,255,255,0.04); border: 1px solid var(--zs-border);
  border-radius: 10px; padding: 10px 16px;
  animation: zs-fadeup 0.7s 0.4s ease both;
}
.zs-prompt { color: var(--zs-accent-2); }
.zs-cmd-text { color: var(--zs-text); }
.zs-showcase { padding: 0 0 100px; }
</style>
