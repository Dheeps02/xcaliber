<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{ type: string }>()
const el = ref<HTMLElement | null>(null)
let root: { unmount: () => void } | null = null

onMounted(async () => {
  if (!el.value) return
  const [{ createRoot }, { createElement }, { PacketRowDemo }] = await Promise.all([
    import('react-dom/client'),
    import('react'),
    import('./PacketRowDemo.tsx'),
  ])
  root = createRoot(el.value)
  root.render(createElement(PacketRowDemo, { type: props.type as any }))
})

onBeforeUnmount(() => root?.unmount())
</script>

<template>
  <div ref="el" />
</template>
