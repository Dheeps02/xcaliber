<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const el = ref<HTMLElement | null>(null)
let root: { unmount: () => void } | null = null

onMounted(async () => {
  if (!el.value) return
  const [{ createRoot }, { createElement }, { BroomButtonDemo }] = await Promise.all([
    import('react-dom/client'),
    import('react'),
    import('./BroomButtonDemo.tsx'),
  ])
  root = createRoot(el.value)
  root.render(createElement(BroomButtonDemo, {}))
})

onBeforeUnmount(() => root?.unmount())
</script>

<template>
  <span ref="el" style="display: inline-flex; align-items: center; vertical-align: middle; background: var(--vp-code-bg); border-radius: 4px; padding: 2px 4px;" />
</template>
