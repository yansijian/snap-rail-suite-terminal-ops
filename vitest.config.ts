import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    server: {
      deps: {
        // Client-side @snap-rail packages carry stylesheets in their ESM
        // faces (`framework-shadcn/lib/runtime.js` imports
        // `./ui/theme.css`); node's loader cannot serve a bare `.css`.
        // Inline the whole scope so vite's css stubbing sees every import —
        // inlining must be transitive, an externalized package's imports
        // never reach vite.
        inline: [/@snap-rail\//],
      },
    },
  },
})
