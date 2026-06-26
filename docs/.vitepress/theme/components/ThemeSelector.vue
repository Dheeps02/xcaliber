<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const STORAGE_KEY = 'xcb-theme'

const themes = [
  { id: null,           name: 'Emerald',          colors: ['#10b981', '#38bdf8', '#4ade80'] },
  { id: 'nord',         name: 'Nord',             colors: ['#88C0D0', '#5E81AC', '#A3BE8C'] },
  { id: 'catppuccin',   name: 'Catppuccin Mocha', colors: ['#CBA6F7', '#89B4FA', '#A6E3A1'] },
  { id: 'gruvbox',      name: 'Gruvbox Dark',     colors: ['#FABD2F', '#83A598', '#B8BB26'] },
  { id: 'tokyo-night',  name: 'Tokyo Night',      colors: ['#7AA2F7', '#BB9AF7', '#9ECE6A'] },
  { id: 'dracula',      name: 'Dracula',          colors: ['#BD93F9', '#50FA7B', '#F1FA8C'] },
  { id: 'one-dark',     name: 'One Dark',         colors: ['#61AFEF', '#98C379', '#E5C07B'] },
  { id: 'everforest',   name: 'Everforest',       colors: ['#A7C080', '#7FBBB3', '#DBBC7F'] },
  { id: 'rose-pine',    name: 'Rosé Pine',        colors: ['#EBBCBA', '#C4A7E7', '#9CCFD8'] },
  { id: 'monokai',      name: 'Monokai',          colors: ['#A6E22E', '#66D9E8', '#F92672'] },
  { id: 'oled',         name: 'OLED',             colors: ['#FFFFFF', '#888888', '#444444'] },
]

const current = ref(null)
const open = ref(false)
const dropdownRef = ref(null)

function select(id) {
  current.value = id
  if (id) {
    document.documentElement.setAttribute('data-xcb-theme', id)
    localStorage.setItem(STORAGE_KEY, id)
  } else {
    document.documentElement.removeAttribute('data-xcb-theme')
    localStorage.removeItem(STORAGE_KEY)
  }
  open.value = false
}

function currentTheme() {
  return themes.find(t => t.id === current.value) ?? themes[0]
}

function onClickOutside(e) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    open.value = false
  }
}

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) select(saved)
  document.addEventListener('click', onClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<template>
  <div class="xcb-theme-selector" ref="dropdownRef">
    <button class="xcb-theme-btn" @click="open = !open" :aria-expanded="open">
      <span class="xcb-swatches">
        <span v-for="c in currentTheme().colors" :key="c" class="xcb-swatch" :style="{ background: c }" />
      </span>
      <span class="xcb-theme-name">{{ currentTheme().name }}</span>
      <svg class="xcb-chevron" :class="{ open }" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <div v-if="open" class="xcb-dropdown">
      <button
        v-for="theme in themes"
        :key="theme.id ?? 'emerald'"
        class="xcb-dropdown-item"
        :class="{ active: current === theme.id }"
        @click="select(theme.id)"
      >
        <span class="xcb-swatches">
          <span v-for="c in theme.colors" :key="c" class="xcb-swatch" :style="{ background: c }" />
        </span>
        <span>{{ theme.name }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.xcb-theme-selector {
  position: relative;
  display: flex;
  align-items: center;
  order: 3;
  margin: 0 8px;
}

.xcb-theme-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  width: 188px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: transparent;
  cursor: pointer;
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  white-space: nowrap;
  overflow: hidden;
}

.xcb-theme-btn:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
}

.xcb-swatches {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}

.xcb-swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.xcb-chevron {
  transition: transform 0.15s;
  opacity: 0.6;
}
.xcb-chevron.open {
  transform: rotate(180deg);
}

.xcb-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 180px;
  background: var(--vp-c-bg-elv);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  z-index: 100;
}

.xcb-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 5px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  text-align: left;
  transition: background 0.1s, color 0.1s;
}

.xcb-dropdown-item:hover {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
}

.xcb-dropdown-item.active {
  color: var(--vp-c-brand-1);
}
</style>
