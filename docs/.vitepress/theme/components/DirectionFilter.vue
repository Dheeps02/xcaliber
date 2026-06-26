<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const el = ref<HTMLElement | null>(null)
let root: { unmount: () => void } | null = null

onMounted(async () => {
  if (!el.value) return
  const [{ createRoot }, { createElement }, { DirectionFilterDemo }] = await Promise.all([
    import('react-dom/client'),
    import('react'),
    import('./DirectionFilterDemo.tsx'),
  ])
  root = createRoot(el.value)
  root.render(createElement(DirectionFilterDemo, {}))
})

onBeforeUnmount(() => root?.unmount())
</script>

<template>
  <div ref="el" />
</template>
