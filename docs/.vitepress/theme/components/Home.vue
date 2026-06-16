<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import HomeNav from './HomeNav.vue'
import HomeHero from './HomeHero.vue'
import HomeFeatures from './HomeFeatures.vue'
import HomeInternals from './HomeInternals.vue'
import HomeThemes from './HomeThemes.vue'
import HomeBuiltFor from './HomeBuiltFor.vue'
import HomeCta from './HomeCta.vue'

const navVisible = ref(true)
let lastScrollY = 0

function onScroll() {
  const y = window.scrollY
  navVisible.value = y < lastScrollY || y < 80
  lastScrollY = y
}

onMounted(() => { window.addEventListener('scroll', onScroll, { passive: true }) })
onUnmounted(() => { window.removeEventListener('scroll', onScroll) })
</script>

<template>
  <div class="zs-root">
    <div class="zs-grain" aria-hidden="true"></div>
    <HomeNav :visible="navVisible" />
    <HomeHero />
    <HomeFeatures />
    <HomeInternals />
    <HomeThemes />
    <HomeBuiltFor />
    <HomeCta />
  </div>
</template>
