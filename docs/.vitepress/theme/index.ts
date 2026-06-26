import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import Home from './components/Home.vue'
import ThemeSelector from './components/ThemeSelector.vue'
import PacketRow from './components/PacketRow.vue'
import PacketExpandRow from './components/PacketExpandRow.vue'
import DirectionFilter from './components/DirectionFilter.vue'
import ColumnSearch from './components/ColumnSearch.vue'
import AutoScrollToggle from './components/AutoScrollToggle.vue'
import BroomButton from './components/BroomButton.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-before': () => h(ThemeSelector),
    })
  },
  enhanceApp({ app }) {
    app.component('Home', Home)
    app.component('PacketRow', PacketRow)
    app.component('PacketExpandRow', PacketExpandRow)
    app.component('DirectionFilter', DirectionFilter)
    app.component('ColumnSearch', ColumnSearch)
    app.component('AutoScrollToggle', AutoScrollToggle)
    app.component('BroomButton', BroomButton)
  },
}
