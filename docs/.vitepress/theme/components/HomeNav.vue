<script setup>
defineProps({
  visible: { type: Boolean, default: true },
})
</script>

<template>
  <nav class="zs-nav" :class="{ 'zs-nav--hidden': !visible }">
    <a href="/" class="zs-logo">
      <span class="zs-logo-mark">Z</span>
      <span class="zs-logo-name">zenscope</span>
    </a>
    <div class="zs-nav-links">
      <a href="/guide/getting-started" class="zs-nav-link">
        <svg width="13" height="13" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M208,24H72A32,32,0,0,0,40,56V224a8,8,0,0,0,8,8H192a8,8,0,0,0,0-16H56a16,16,0,0,1,16-16H208a8,8,0,0,0,8-8V32A8,8,0,0,0,208,24Zm-8,160H72a31.8,31.8,0,0,0-16,4.29V56A16,16,0,0,1,72,40H200Z"/></svg>
        Docs
      </a>
      <a href="/features/daq" class="zs-nav-link">
        <svg width="13" height="13" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M215.79,118.17a8,8,0,0,0-5-5.66L153.18,90.9l14.66-73.33a8,8,0,0,0-13.69-7l-112,120a8,8,0,0,0,3,13l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l112-120A8,8,0,0,0,215.79,118.17Z"/></svg>
        Features
      </a>
      <a href="/reference/rest-api" class="zs-nav-link">
        <svg width="13" height="13" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M69.12 94.15 28.5 128l40.62 33.85a8 8 0 1 1-10.24 12.29l-48-40a8 8 0 0 1 0-12.29l48-40a8 8 0 0 1 10.24 12.3Zm176 27.71-48-40a8 8 0 1 0-10.24 12.29L227.5 128l-40.62 33.85a8 8 0 1 0 10.24 12.29l48-40a8 8 0 0 0 0-12.28Zm-82.39-89.63a8 8 0 0 0-10.25 4.77l-64 176a8 8 0 0 0 4.77 10.25A7.77 7.77 0 0 0 96 224a8 8 0 0 0 7.52-5.23l64-176a8 8 0 0 0-4.79-10.54Z"/></svg>
        API
      </a>
      <a href="/reference/contributing" class="zs-nav-link">
        <svg width="13" height="13" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M208.31 75.68A59.78 59.78 0 0 0 202.93 28a8 8 0 0 0-6.93-4 59.75 59.75 0 0 0-48 24h-24a59.75 59.75 0 0 0-48-24 8 8 0 0 0-6.93 4 59.78 59.78 0 0 0-5.38 47.68A58.14 58.14 0 0 0 56 104v8a56.06 56.06 0 0 0 48.44 55.47A39.8 39.8 0 0 0 96 192v8H72a24 24 0 0 1-24-24 40 40 0 0 0-40-40 8 8 0 0 0 0 16 24 24 0 0 1 24 24 40 40 0 0 0 40 40h24v16a8 8 0 0 0 16 0v-40a24 24 0 0 1 48 0v40a8 8 0 0 0 16 0v-40a39.8 39.8 0 0 0-8.44-24.53A56.06 56.06 0 0 0 216 112v-8a58.14 58.14 0 0 0-7.69-28.32Z"/></svg>
        Contributing
      </a>
    </div>
    <div class="zs-nav-actions">
      <a href="https://github.com/Dheeps02/xcaliber" target="_blank" rel="noopener" class="zs-star">
        <svg width="15" height="15" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M208.31 75.68A59.78 59.78 0 0 0 202.93 28a8 8 0 0 0-6.93-4 59.75 59.75 0 0 0-48 24h-24a59.75 59.75 0 0 0-48-24 8 8 0 0 0-6.93 4 59.78 59.78 0 0 0-5.38 47.68A58.14 58.14 0 0 0 56 104v8a56.06 56.06 0 0 0 48.44 55.47A39.8 39.8 0 0 0 96 192v8H72a24 24 0 0 1-24-24 40 40 0 0 0-40-40 8 8 0 0 0 0 16 24 24 0 0 1 24 24 40 40 0 0 0 40 40h24v16a8 8 0 0 0 16 0v-40a24 24 0 0 1 48 0v40a8 8 0 0 0 16 0v-40a39.8 39.8 0 0 0-8.44-24.53A56.06 56.06 0 0 0 216 112v-8a58.14 58.14 0 0 0-7.69-28.32Z"/></svg>
        <span>Star on GitHub</span>
      </a>
      <a href="/guide/getting-started" class="zs-btn-download">
        <svg width="13" height="13" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M240 136v64a16 16 0 0 1-16 16H32a16 16 0 0 1-16-16v-64a16 16 0 0 1 16-16h48a8 8 0 0 1 0 16H32v64h192v-64h-48a8 8 0 0 1 0-16h48a16 16 0 0 1 16 16Zm-114.34-61.66a8 8 0 0 1 10.68 0l40 40a8 8 0 0 1-11.31 11.31L136 96.69V176a8 8 0 0 1-16 0V96.69l-29.03 29.0a8 8 0 0 1-11.31-11.31Z"/></svg>
        Download
      </a>
    </div>
  </nav>
</template>

<style scoped>
.zs-nav {
  position: sticky; top: 0; z-index: 100;
  display: flex; align-items: center; gap: 32px;
  padding: 0 40px; height: 64px;
  background: rgba(6,12,10,0.85);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--zs-border);
  transition: transform 0.3s ease;
}
.zs-nav--hidden { transform: translateY(-100%); }
.zs-nav-links { display: flex; align-items: center; gap: 2px; flex: 1; }
.zs-nav-link {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 14px; color: var(--zs-muted); text-decoration: none;
  padding: 6px 12px; border-radius: 6px; transition: color 0.15s;
}
.zs-nav-link:hover { color: var(--zs-text); }
.zs-nav-actions { display: flex; align-items: center; gap: 10px; }
.zs-star {
  display: flex; align-items: center; gap: 7px;
  font-size: 13px; color: var(--zs-muted); text-decoration: none;
  padding: 6px 14px; border: 1px solid var(--zs-border); border-radius: 8px;
  transition: border-color 0.15s, color 0.15s;
}
.zs-star:hover { border-color: rgba(16,185,129,0.55); color: #fff; }
.zs-star svg { transition: filter 0.2s ease, color 0.2s ease; }
.zs-star:hover svg { color: var(--zs-accent-2); filter: drop-shadow(0 0 5px rgba(110,231,183,0.65)); }
.zs-btn-download {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 500; color: #000; background: var(--zs-accent);
  text-decoration: none; padding: 7px 16px; border-radius: 8px; transition: box-shadow 0.2s;
}
.zs-btn-download:hover { box-shadow: 0 9px 30px rgba(16,185,129,0.45); }

@media (max-width: 960px) { .zs-nav-links { display: none; } }
@media (max-width: 600px) { .zs-nav { padding: 0 20px; } .zs-star span { display: none; } }
</style>
