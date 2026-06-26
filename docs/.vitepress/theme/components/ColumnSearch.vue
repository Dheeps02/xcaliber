<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const el = ref<HTMLElement | null>(null)
let root: { unmount: () => void } | null = null

onMounted(async () => {
  if (!el.value) return
  const [{ createRoot }, { createElement }, { ColumnSearchDemo }] = await Promise.all([
    import('react-dom/client'),
    import('react'),
    import('./ColumnSearchDemo.tsx'),
  ])
  root = createRoot(el.value)
  root.render(createElement(ColumnSearchDemo, {}))
})

onBeforeUnmount(() => root?.unmount())
</script>

<template>
  <div ref="el" />
</template>
