/**
 * The suite's floating-ball face: the live shift count as a self-drawn orb.
 *
 * It occupies `shell.ball` in the ball window and paints the whole 128px
 * surface — a plugin-rendered ball, not the framework default. The data path
 * is the **host-aggregated** `production/stats-changed` frame: an auxiliary
 * surface never subscribes to equipment points, because a hidden ball must not
 * keep a data path alive. Everything it shows is a projection of that frame.
 *
 * Geometry and docking follow the Shell's contract: the window is
 * {@link BALL_SURFACE.size} px, the orb keeps an inset rim, and the drop
 * shadow is painted as a radial gradient that fades to zero before the window
 * edge — a `box-shadow` would be clipped into a hard grey band there. While
 * the ball is parked and tucked (`shell/ball-dock-changed`), the face draws a
 * compact tab inside the visible strip instead of the cropped orb.
 *
 * Colours come from the framework's theme tokens (`var(--color-*)`) rather
 * than tailwind classes: the suite's bundle carries no compiled stylesheet, and
 * the framework's theme is loaded into every window it serves.
 *
 * @module @snap-rail/suite-terminal-ops/ball
 */

import type { Plugin } from '@snap-rail/cordis'
import { subscribeFrame, type HostLink } from '@snap-rail/connection'
import { UI_SLOT_IDS } from '@snap-rail/framework-shadcn/slots'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
// Type-only, but it is what merges the `shell.*` rows into the protocol map:
// the wire calls below are typed because this module is in the program.
import {
  BALL_SURFACE,
  ballDockStateSchema,
  surfaceStateSchema,
  type BallDockState,
  type SurfaceState,
} from '@snap-rail/shell/contract'
import { SHIFT_CAPTION, productionStatsSnapshotSchema, type ProductionStatsSnapshot } from './contract.ts'

/** Ask the Shell for a surface (the ball's only action is "bring up the app"). */
function present(link: HostLink, surface: 'main'): void {
  void link.call('shell.surface.present', { surface })
}

/**
 * Follow the operator window's visibility so the orb's caption tells the truth:
 * bringing an already-open window forward is a different act from opening it.
 * One initial read (`shell.surface.state`) plus the `shell/surface-changed`
 * push — a ball born while the window is hidden must not believe the opposite.
 */
function useMainVisible(link: HostLink): boolean {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    let live = true
    void link.call('shell.surface.state', {}).then(result => {
      if (!live || !result.ok) return
      const main = result.value.find(state => state.surface === 'main')
      if (main !== undefined) setVisible(main.visible)
    }).catch(() => {})
    const drop = subscribeFrame(link, 'shell/surface-changed', surfaceStateSchema, (next: SurfaceState) => {
      if (next.surface === 'main') setVisible(next.visible)
    })
    return () => {
      live = false
      drop()
    }
  }, [link])
  return visible
}

/** The resting dock state: free-floating, fully visible. */
const IDLE_DOCK: BallDockState = {
  edge: null,
  collapsed: false,
  visiblePx: Math.max(1, Math.round(BALL_SURFACE.size * BALL_SURFACE.dockVisibleRatio)),
}

/**
 * Follow the ball window's dock state: one initial read plus the push. A face
 * that ignores it renders the full orb and lets the screen edge crop it; this
 * face draws a deliberate tab instead.
 */
function useBallDock(link: HostLink): BallDockState {
  const [state, setState] = useState<BallDockState>(IDLE_DOCK)
  useEffect(() => {
    let live = true
    void link.call('shell.ball.dock', {}).then(result => {
      if (live && result.ok) setState(result.value)
    })
    const drop = subscribeFrame(link, 'shell/ball-dock-changed', ballDockStateSchema, next => {
      setState(next)
    })
    return () => {
      live = false
      drop()
    }
  }, [link])
  return state
}

/** The tucked tab: the parked ball's collapsed look, inside the visible strip. */
function DockTab(props: { link: HostLink, dock: BallDockState, signedOn: boolean, count: number | null, shift: keyof typeof SHIFT_CAPTION | null }): ReactNode {
  const horizontal = props.dock.edge === 'left' || props.dock.edge === 'right'
  const tab: CSSProperties = {
    position: 'absolute',
    ...(props.dock.edge === 'left' ? { left: 0, borderRadius: '0 12px 12px 0' } : {}),
    ...(props.dock.edge === 'right' ? { right: 0, borderRadius: '12px 0 0 12px' } : {}),
    ...(props.dock.edge === 'top' ? { top: 0, borderRadius: '0 0 12px 12px' } : {}),
    ...(props.dock.edge === 'bottom' ? { bottom: 0, borderRadius: '12px 12px 0 0' } : {}),
    width: horizontal ? props.dock.visiblePx : 44,
    height: horizontal ? 104 : props.dock.visiblePx,
    border: '1px solid var(--color-border)',
    borderRightWidth: props.dock.edge === 'left' ? 0 : undefined,
    borderLeftWidth: props.dock.edge === 'right' ? 0 : undefined,
    borderBottomWidth: props.dock.edge === 'top' ? 0 : undefined,
    borderTopWidth: props.dock.edge === 'bottom' ? 0 : undefined,
    background: 'var(--color-card)',
    color: 'var(--color-card-foreground)',
    display: 'flex',
    flexDirection: horizontal ? 'column' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
    // The tab is the drag handle while tucked: grabbing it pulls the ball
    // back into the work area.
    WebkitAppRegion: 'drag',
  } as CSSProperties
  const button: CSSProperties = {
    width: '100%',
    height: '100%',
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    display: 'flex',
    flexDirection: 'inherit',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    cursor: 'default',
    WebkitAppRegion: 'no-drag',
  } as CSSProperties
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: 'transparent' }}>
      <div style={tab}>
        <button
          type="button"
          title="打开主窗口"
          onClick={() => present(props.link, 'main')}
          style={button}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: props.signedOn ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
            }}
          />
          {props.shift !== null
            ? <span style={{ fontSize: 12, fontWeight: 600, writingMode: horizontal ? 'vertical-rl' : 'horizontal-tb' }}>
                {SHIFT_CAPTION[props.shift]}
              </span>
            : null}
        </button>
      </div>
    </div>
  )
}

/**
 * The orb itself: the anchored shift count, a live/muted ring, and the shift
 * caption. The window-sized layer behind the disc paints the shadow, faded to
 * zero before the window edge. The outer disc drags the window; the inner disc
 * is the click target, because a `drag` region swallows clicks in Electron.
 */
function CountOrb(props: { link: HostLink }): ReactNode {
  const [snapshot, setSnapshot] = useState<ProductionStatsSnapshot | null>(null)
  const dock = useBallDock(props.link)

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

  if (dock.edge !== null && dock.collapsed) {
    return (
      <DockTab
        link={props.link}
        dock={dock}
        signedOn={signedOn}
        count={anchor?.count ?? null}
        shift={anchor?.shift ?? null}
      />
    )
  }

  // The shadow is painted on the window-sized layer behind the disc and fades
  // to zero before the window edge — inside the inset the contract reserves.
  const shadowLayer: CSSProperties = {
    position: 'relative',
    width: BALL_SURFACE.size,
    height: BALL_SURFACE.size,
    background: 'radial-gradient(circle at 50% calc(50% + 2px), rgba(0, 0, 0, 0.32) 0 54px, rgba(0, 0, 0, 0) 61px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const disc: CSSProperties = {
    width: BALL_SURFACE.orb,
    height: BALL_SURFACE.orb,
    borderRadius: '50%',
    background: ring,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitAppRegion: 'drag',
  } as CSSProperties

  const core: CSSProperties = {
    width: BALL_SURFACE.orb - 2 * BALL_SURFACE.inset,
    height: BALL_SURFACE.orb - 2 * BALL_SURFACE.inset,
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
      <div style={shadowLayer}>
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
