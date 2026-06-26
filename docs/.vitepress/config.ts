import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default withMermaid(
  defineConfig({
    title: "ZenScope",
    description:
      "Open-source XCP client for automotive ECU calibration and measurement",

    head: [
      ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
      [
        "link",
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
      ],
      [
        "link",
        {
          href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=IBM+Plex+Sans:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
          rel: "stylesheet",
        },
      ],
    ],

    themeConfig: {
      outline: {
        level: "deep",
      },

      sidebar: [
        {
          text: "Guide",
          items: [
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Slave Setup", link: "/guide/slave-setup" },
            { text: "First Steps", link: "/guide/first-steps" },
          ],
        },
        {
          text: "Features",
          items: [
            { text: "DAQ & Live Plots", link: "/features/daq" },
            { text: "Packet Trace", link: "/features/trace" },
          ],
        },
        {
          text: "Reference",
          items: [
            { text: "Architecture", link: "/reference/architecture" },
            { text: "REST API", link: "/reference/rest-api" },
            { text: "Contributing", link: "/reference/contributing" },
          ],
        },
      ],

      socialLinks: [
        { icon: "github", link: "https://github.com/Dheeps02/xcaliber" },
      ],
    },

    markdown: {
      theme: {
        dark: "everforest-dark",
        light: "everforest-light",
      },
    },

    vite: {
      esbuild: {
        jsx: "automatic",
        jsxImportSource: "react",
      },
      resolve: {
        alias: {
          "@xcb-styles": path.resolve(__dirname, "../../frontend/src/styles"),
        },
      },
      server: {
        port: 5174,
        strictPort: true,
      },
    },
  }),
);
