/**
 * The suite's floating-ball face: the live shift count as a self-drawn orb.
 *
 * It occupies `shell.ball` in the ball window and paints the whole 128px
 * surface — a plugin-rendered ball, not the framework default. The data path is
 * the **host-aggregated** `production/stats-changed` frame: an auxiliary
 * surface never subscribes to equipment points, because a hidden ball must not
 * keep a data path alive. Everything it shows is a projection of that frame.
 *
 * Colours come from the framework's theme tokens (`var(--color-*)`) rather than
 * tailwind classes: the suite's bundle carries no compiled stylesheet, and the
 * framework's theme is loaded into every window it serves.
 *
 * @module @snap-rail/suite-terminal-ops/ball
 */

import type { Plugin } from '@snap-rail/cordis'
import { subscribeFrame, type HostLink } from '@snap-rail/connection'
import { UI_SLOT_IDS } from '@snap-rail/framework-shadcn/slots'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
// Type-only, but it is what merges the `shell.*` rows into the protocol map:
// the wire calls below are typed because this module is in the program.
import type { SurfaceState } from '@snap-rail/shell/contract'
import { surfaceStateSchema } from '@snap-rail/shell/contract'
import { SHIFT_CAPTION, productionStatsSnapshotSchema, type ProductionStatsSnapshot } from './contract.ts'

/** The window is 128px; the orb keeps a 8px rim for its shadow. */
const ORB = 112

/** Ask the Shell for a surface (the ball's only action is "bring up the app"). */
function present(link: HostLink, surface: 'main' | 'panel'): void {
  void link.call('shell.surface.present', { surface })
}

/**
 * Follow the operator window's visibility so the orb's caption tells the truth:
 * bringing an already-open window forward is a different act from opening it.
 * The `shell/surface-changed` frame is the same vocabulary the default faces use.
 */
function useMainVisible(link: HostLink): boolean {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const drop = subscribeFrame(link, 'shell/surface-changed', surfaceStateSchema, (next: SurfaceState) => {
      if (next.surface === 'main') setVisible(next.visible)
    })
    return () => { drop() }
  }, [link])
  return visible
}

/**
 * The orb itself: the anchored shift count, a live/muted ring, and the shift
 * caption. The outer disc drags the window; the inner disc is the click target,
 * because a `drag` region swallows clicks in Electron.
 */
function CountOrb(props: { link: HostLink }): ReactNode {
  const [snapshot, setSnapshot] = useState<ProductionStatsSnapshot | null>(null)

  useEffect(() => {
    // The frame is broadcast on every flush cycle, idle included — no read
    // method, no polling, and a freshly shown ball catches the next cycle.
    const drop = subscribeFrame(props.link, 'production/stats-changed', productionStatsSnapshotSchema, next => {
      setSnapshot(next)
    })
    return () => { drop() }
  }, [props.link])

  const anchor = snapshot?.anchor ?? null
  const signedOn = anchor !== null
  const mainVisible = useMainVisible(props.link)
  // The ring is a *state* indicator (counting / signed off), not a fabricated
  // percentage: the suite has no shift target to divide by.
  const ring = signedOn
    ? `conic-gradient(var(--color-primary) 360deg, var(--color-primary) 0deg)`
    : `conic-gradient(var(--color-border) 360deg, var(--color-border) 0deg)`

  const disc: CSSProperties = {
    width: ORB,
    height: ORB,
    borderRadius: '50%',
    background: ring,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.35)',
    WebkitAppRegion: 'drag',
  } as CSSProperties

  const core: CSSProperties = {
    width: ORB - 16,
    height: ORB - 16,
    borderRadius: '50%',
    border: '1px solid var(--color-border)',
    background: 'var(--color-card)',
    color: signedOn ? 'var(--color-card-foreground)' : 'var(--color-muted-foreground)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: 0,
    cursor: 'default',
    fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
    WebkitAppRegion: 'no-drag',
  } as CSSProperties

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
      <div style={disc}>
        <button
          type="button"
          title={mainVisible ? '切换到主窗口' : '打开主窗口'}
          onClick={() => present(props.link, 'main')}
          style={core}
        >
          <span style={{ fontSize: anchor === null ? 16 : 22, fontWeight: 700, lineHeight: 1 }}>
            {anchor === null ? '—' : anchor.count}
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-muted-foreground)' }}>
            {anchor === null ? '未登录' : SHIFT_CAPTION[anchor.shift]}
          </span>
        </button>
      </div>
    </div>
  )
}

/** The ball face plugin: one occupant of `shell.ball`. */
const ballPlugin: Plugin.Object<void> = {
  name: 'suite-terminal-ops/ball',
  inject: ['uiSlots', 'client'],
  apply(ctx): void {
    ctx.uiSlots.register(ctx, UI_SLOT_IDS.ball, {
      id: 'suite-count-orb',
      order: 10,
      render: (): ReactNode => <CountOrb link={ctx.client.link} />,
    })
  },
}

export default ballPlugin