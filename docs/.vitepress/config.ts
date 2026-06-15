import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(defineConfig({
  title: 'ZenScope',
  description: 'Open-source XCP client for automotive ECU calibration and measurement',

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Features', link: '/features/daq' },
      { text: 'Reference', link: '/reference/architecture' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Use Cases', link: '/guide/use-cases' },
            { text: 'Configuration', link: '/guide/configuration' },
          ],
        },
      ],
      '/features/': [
        {
          text: 'Features',
          items: [
            { text: 'DAQ & Live Plots', link: '/features/daq' },
            { text: 'Packet Trace', link: '/features/trace' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Architecture', link: '/reference/architecture' },
            { text: 'REST API', link: '/reference/rest-api' },
            { text: 'Contributing', link: '/reference/contributing' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Dheeps02/xcaliber' },
    ],
  },

  vite: {
    server: {
      port: 5174,
      strictPort: true,
    },
  },
}))
