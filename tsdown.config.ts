import { defineConfig } from 'tsdown'
import { clientBundle } from '@snap-rail/plugin-kit'

/**
 * The suite's two faces in one package:
 *
 * - host (`src/stats.ts` → `lib/stats.js`, the `./stats` subpath and npm
 *   main): the durable shift counter — settings seam + store tables +
 *   `production/stats-changed` frames. tsc compiles it to
 *   `lib/types/stats.js`; this config re-bundles that node-side output.
 * - renderer (`src/index.tsx` → `lib-client/client.js`): the installable
 *   CJS factory bundle the pool-installed renderer loads over
 *   snap-plugin://, seeds external.
 *
 * `clientBundle` comes from the published `@snap-rail/plugin-kit` package:
 * an independent repository's kit is a finished npm artifact, so the
 * by-name import is stable here (the monorepo imports the kit by source
 * path to dodge the previous-build coupling).
 */
export default defineConfig([
  {
    entry: { stats: 'lib/types/stats.js' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    external: [/\.(png|jpe?g|webp|gif|svg)$/, /\.css$/],
  },
  // One bundle per window. The main surface registers as the package itself;
  // the auxiliary surfaces register as `<package>/ball` / `<package>/panel` and
  // emit beside the main bundle (`lib-client/ball.js`, `lib-client/panel.js`) —
  // the files `snapRail.client.surfaces` points at.
  clientBundle('@snap-rail/suite-terminal-ops', 'src/index.tsx'),
  clientBundle('@snap-rail/suite-terminal-ops/ball', 'src/ball.tsx', { outName: 'ball' }),
  clientBundle('@snap-rail/suite-terminal-ops/panel', 'src/panel.tsx', { outName: 'panel' }),
])
