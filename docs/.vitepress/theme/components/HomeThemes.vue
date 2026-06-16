<script setup>
const themes = [
  { name: 'Nord',            colors: ['#88C0D0','#5E81AC','#BF616A'], bg: '#2E3440', fg: '#D8DEE9' },
  { name: 'Catppuccin Mocha',colors: ['#CBA6F7','#89B4FA','#A6E3A1'], bg: '#1E1E2E', fg: '#CDD6F4' },
  { name: 'Gruvbox Dark',    colors: ['#FABD2F','#B8BB26','#FB4934'], bg: '#282828', fg: '#EBDBB2' },
  { name: 'Tokyo Night',     colors: ['#7AA2F7','#BB9AF7','#9ECE6A'], bg: '#1A1B26', fg: '#C0CAF5' },
  { name: 'Dracula',         colors: ['#BD93F9','#50FA7B','#F1FA8C'], bg: '#282A36', fg: '#F8F8F2' },
  { name: 'One Dark',        colors: ['#61AFEF','#98C379','#E5C07B'], bg: '#282C34', fg: '#ABB2BF' },
  { name: 'Everforest',      colors: ['#A7C080','#83C092','#E69875'], bg: '#2D353B', fg: '#D3C6AA' },
  { name: 'Rosé Pine',       colors: ['#EBBCBA','#C4A7E7','#9CCFD8'], bg: '#191724', fg: '#E0DEF4' },
  { name: 'Monokai',         colors: ['#A6E22E','#F92672','#E6DB74'], bg: '#272822', fg: '#F8F8F2' },
  { name: 'OLED',            colors: ['#FFFFFF','#888888','#444444'], bg: '#000000', fg: '#FFFFFF' },
]
</script>

<template>
  <section class="zs-themes">
    <div class="zs-container zs-themes-header">
      <div class="zs-section-eyebrow">
        <svg width="12" height="12" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M200.77,53.89A103.27,103.27,0,0,0,128,24h-1.07A104,104,0,0,0,24,128c0,43,26.58,79.06,69.36,94.17A32,32,0,0,0,136,192a16,16,0,0,1,16-16h46.21a31.81,31.81,0,0,0,31.2-24.88,104.43,104.43,0,0,0,2.59-24A103.28,103.28,0,0,0,200.77,53.89Z"/></svg>
        Themes
      </div>
      <h2 class="zs-section-title">Your workspace, your aesthetic</h2>
      <p class="zs-themes-sub">Ten-plus hand-tuned themes, switchable instantly — because calibration sessions run long.</p>
    </div>
    <div class="zs-marquee-wrap">
      <div class="zs-marquee">
        <template v-for="pass in 2" :key="pass">
          <div
            v-for="theme in themes"
            :key="`${pass}-${theme.name}`"
            class="zs-theme-chip"
            :style="{'--chip-bg': theme.bg, '--chip-fg': theme.fg}"
            :aria-hidden="pass === 2 ? 'true' : undefined"
          >
            <span class="zs-theme-swatches">
              <span v-for="c in theme.colors" :key="c" class="zs-theme-swatch" :style="{background: c}"></span>
            </span>
            <span class="zs-theme-name">{{ theme.name }}</span>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.zs-themes { padding: 80px 0; border-top: 1px solid var(--zs-border); overflow: hidden; }
.zs-themes-header { text-align: center; margin-bottom: 12px; }
.zs-themes-header .zs-section-eyebrow { justify-content: center; }
.zs-themes-header .zs-section-title { margin-bottom: 8px; }
.zs-themes-sub { font-size: 16px; color: var(--zs-muted); text-align: center; margin-bottom: 40px; }
.zs-marquee-wrap {
  overflow: hidden;
  mask: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
  -webkit-mask: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
}
.zs-marquee {
  display: flex; width: max-content;
  animation: zs-marquee 36s linear infinite;
}
.zs-marquee:hover { animation-play-state: paused; }
.zs-theme-chip {
  display: inline-flex; align-items: center; gap: 10px;
  background: color-mix(in srgb, var(--chip-bg) 90%, transparent);
  border: 1px solid color-mix(in srgb, var(--chip-bg), white 18%);
  border-radius: 10px; padding: 10px 18px; margin: 0 8px;
  white-space: nowrap; user-select: none;
}
.zs-theme-swatches { display: flex; gap: 4px; flex-shrink: 0; }
.zs-theme-swatch { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.zs-theme-name { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: var(--chip-fg); }
</style>
