<template>
  <!-- CTA -->
  <section class="zs-cta">
    <div class="zs-container">
      <div class="zs-cta-inner">
        <div class="zs-cta-aurora" data-aurora aria-hidden="true">
          <div class="zs-aurora-blob zs-aurora-blob-1"></div>
          <div class="zs-aurora-blob zs-aurora-blob-2"></div>
        </div>
        <h2 class="zs-cta-title">Ready to scope your ECU?</h2>
        <p class="zs-cta-sub">Free, open-source, GPL-3.0. No login. No telemetry. Just you and your ECU.</p>
        <div class="zs-cta-btns">
          <a href="/guide/getting-started" class="zs-btn-primary">
            <svg width="15" height="15" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M240 136v64a16 16 0 0 1-16 16H32a16 16 0 0 1-16-16v-64a16 16 0 0 1 16-16h48a8 8 0 0 1 0 16H32v64h192v-64h-48a8 8 0 0 1 0-16h48a16 16 0 0 1 16 16Zm-114.34-61.66a8 8 0 0 1 10.68 0l40 40a8 8 0 0 1-11.31 11.31L136 96.69V176a8 8 0 0 1-16 0V96.69l-29.03 29.0a8 8 0 0 1-11.31-11.31Z"/></svg>
            Get Started
          </a>
          <a href="https://github.com/Dheeps02/xcaliber" target="_blank" rel="noopener" class="zs-btn-ghost">
            <svg width="15" height="15" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M208.31 75.68A59.78 59.78 0 0 0 202.93 28a8 8 0 0 0-6.93-4 59.75 59.75 0 0 0-48 24h-24a59.75 59.75 0 0 0-48-24 8 8 0 0 0-6.93 4 59.78 59.78 0 0 0-5.38 47.68A58.14 58.14 0 0 0 56 104v8a56.06 56.06 0 0 0 48.44 55.47A39.8 39.8 0 0 0 96 192v8H72a24 24 0 0 1-24-24 40 40 0 0 0-40-40 8 8 0 0 0 0 16 24 24 0 0 1 24 24 40 40 0 0 0 40 40h24v16a8 8 0 0 0 16 0v-40a24 24 0 0 1 48 0v40a8 8 0 0 0 16 0v-40a39.8 39.8 0 0 0-8.44-24.53A56.06 56.06 0 0 0 216 112v-8a58.14 58.14 0 0 0-7.69-28.32Z"/></svg>
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
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M208.31 75.68A59.78 59.78 0 0 0 202.93 28a8 8 0 0 0-6.93-4 59.75 59.75 0 0 0-48 24h-24a59.75 59.75 0 0 0-48-24 8 8 0 0 0-6.93 4 59.78 59.78 0 0 0-5.38 47.68A58.14 58.14 0 0 0 56 104v8a56.06 56.06 0 0 0 48.44 55.47A39.8 39.8 0 0 0 96 192v8H72a24 24 0 0 1-24-24 40 40 0 0 0-40-40 8 8 0 0 0 0 16 24 24 0 0 1 24 24 40 40 0 0 0 40 40h24v16a8 8 0 0 0 16 0v-40a24 24 0 0 1 48 0v40a8 8 0 0 0 16 0v-40a39.8 39.8 0 0 0-8.44-24.53A56.06 56.06 0 0 0 216 112v-8a58.14 58.14 0 0 0-7.69-28.32Z"/></svg>
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
        <span class="zs-footer-copy">© 2026 ZenScope. GPL-3.0.</span>
        <span class="zs-footer-copy">Built for automotive engineers.</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.zs-cta { padding: 120px 0; border-top: 1px solid var(--zs-border); }
.zs-cta-inner {
  position: relative; text-align: center; isolation: isolate;
  padding: 80px 40px; border: 1px solid rgba(16,185,129,0.18);
  border-radius: 24px; overflow: hidden;
}
.zs-cta-aurora { position: absolute; inset: 0; z-index: -1; pointer-events: none; }
.zs-cta-aurora .zs-aurora-blob-1 { width: 60%; height: 80%; top: -20%; left: -10%; opacity: 0.4; }
.zs-cta-aurora .zs-aurora-blob-2 { width: 50%; height: 70%; top: -10%; right: -10%; opacity: 0.35; }
.zs-cta-title {
  font-family: 'Cormorant Garamond', serif; font-size: clamp(36px, 5vw, 64px);
  font-weight: 500; letter-spacing: -0.03em; line-height: 1.1; color: var(--zs-text); margin-bottom: 16px;
}
.zs-cta-sub { font-size: 17px; color: var(--zs-muted); margin: 0 auto 36px; max-width: 480px; }
.zs-cta-btns { display: flex; align-items: center; gap: 14px; justify-content: center; flex-wrap: wrap; }

.zs-footer { padding: 60px 0 40px; border-top: 1px solid var(--zs-border); }
.zs-footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; margin-bottom: 48px; }
.zs-footer-tagline { font-size: 14px; line-height: 1.65; color: var(--zs-faint); margin-top: 14px; max-width: 260px; }
.zs-footer-social { margin-top: 18px; display: flex; gap: 10px; }
.zs-footer-icon { color: var(--zs-faint); text-decoration: none; transition: color 0.15s; }
.zs-footer-icon:hover { color: var(--zs-accent-2); }
.zs-footer-icon svg { transition: filter 0.2s ease; }
.zs-footer-icon:hover svg { filter: drop-shadow(0 0 5px rgba(110,231,183,0.65)); }
.zs-footer-col { display: flex; flex-direction: column; gap: 10px; }
.zs-footer-col-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--zs-muted); margin-bottom: 4px; }
.zs-footer-link { font-size: 14px; color: var(--zs-faint); text-decoration: none; transition: color 0.15s; }
.zs-footer-link:hover { color: var(--zs-accent-2); }
.zs-footer-bottom {
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 8px; padding-top: 24px; border-top: 1px solid var(--zs-border);
}
.zs-footer-copy { font-size: 13px; color: var(--zs-faint); }

@media (max-width: 960px) { .zs-footer-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 600px) { .zs-footer-grid { grid-template-columns: 1fr; } }
</style>
