/**
 * The suite's host-face OS integration (the `@snap-rail/shell` seam): two tray
 * rows, the ball state pushed from the counter, and the actionable shift-handover
 * notification. Driven against a recording fake Shell so the assertions are
 * about the *calls a host face makes*, not about Electron.
 *
 * @module snap-rail/suite-terminal-ops/tests/shell-face.spec
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@snap-rail/cordis'
import gatewayPlugin from '@snap-rail/gateway'
import settingsPlugin from '@snap-rail/settings'
import storePlugin from '@snap-rail/store-sqlite'
import { TimerService as timerPlugin } from '@snap-rail/cordis-plugin-timer'
import type {
  BallPatch,
  BallState,
  ShellNotificationInput,
  ShellNotificationResult,
  ShellResult,
  ShellService,
  ShellTrayEntry,
  ShellTrayItem,
  ShellTrayItemPatch,
  SurfaceState,
} from '@snap-rail/shell'
import productionStatsPlugin from '../src/stats.ts'
import { afterEach, describe, expect, it, vi } from 'vitest'

const contexts: Context[] = []
const tempDirs: string[] = []

afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  vi.useRealTimers()
})

/** Everything the fake Shell recorded. */
interface ShellLog {
  trayAdded: ShellTrayItem[]
  trayUpdated: Array<{ id: string, patch: ShellTrayItemPatch }>
  notifications: ShellNotificationInput[]
  presented: string[]
  hidden: string[]
  balls: BallPatch[]
}

/** A recording Shell adapter: every seam call lands in the log, and the
 * surface state it reports reflects its own present/hide calls. */
function fakeShell(log: ShellLog): ShellService {
  const entries: ShellTrayEntry[] = []
  const visibility: Record<'main' | 'ball' | 'panel', boolean> = { main: true, ball: false, panel: false }
  const availability: Record<'main' | 'ball' | 'panel', boolean> = { main: true, ball: true, panel: false }
  let ball: BallState = { progress: null, label: null, tone: 'neutral' }
  return {
    available: true,
    notify(_caller, input): ShellNotificationResult {
      log.notifications.push(input)
      return { applied: true, id: `toast-${log.notifications.length}` }
    },
    tray: {
      available: true,
      addItem(_caller, item): ShellResult {
        log.trayAdded.push(item)
        entries.push({ ...item, plugin: 'production-stats', key: `production-stats:${item.id}` })
        return { applied: true }
      },
      updateItem(_caller, id, patch): ShellResult {
        log.trayUpdated.push({ id, patch })
        return { applied: true }
      },
      removeItem(): ShellResult {
        return { applied: true }
      },
      entries: () => entries,
    },
    surface: {
      state(): readonly SurfaceState[] {
        return (['main', 'ball', 'panel'] as const).map(surface => ({
          surface,
          available: availability[surface],
          visible: visibility[surface],
        }))
      },
      present(_caller, surface): ShellResult {
        log.presented.push(surface)
        visibility[surface] = true
        return { applied: true }
      },
      hide(_caller, surface): ShellResult {
        log.hidden.push(surface)
        visibility[surface] = false
        return { applied: true }
      },
    },
    ball: {
      state: () => ball,
      setState(_caller, patch): BallState {
        log.balls.push(patch)
        ball = { ...ball, ...patch }
        return ball
      },
    },
  }
}

/** A store-backed counter world with the fake Shell mounted. */
async function makeWorld(): Promise<{ host: Context, log: ShellLog }> {
  const home = mkdtempSync(join(tmpdir(), 'snap-rail-shell-face-'))
  tempDirs.push(home)
  const host = new Context()
  contexts.push(host)
  host.provide('snapRailHome', home)
  await host.plugin(gatewayPlugin, { name: 'station-shell', version: '0.1.0', bin: 'test' })
  await host.plugin(settingsPlugin)
  await host.plugin(storePlugin)
  await host.plugin(timerPlugin)
  const log: ShellLog = { trayAdded: [], trayUpdated: [], notifications: [], presented: [], hidden: [], balls: [] }
  host.provide('shell', fakeShell(log))
  await host.plugin(productionStatsPlugin, { flushMs: 1000 })
  return { host, log }
}

describe('the suite host face on the Shell seam', () => {
  it('contributes the ball toggle and the handover ack, and mirrors the count into the ball state', async () => {
    const { host, log } = await makeWorld()
    expect(log.trayAdded.map(item => item.id)).toEqual(['ball', 'handover'])

    host.settings.set('session.operatorId', 'op-1')
    // Signing on anchors the shift and pushes the (empty) count into the
    // host-aggregated ball state — the default orb renders it.
    expect(log.balls.at(-1)).toEqual({ label: '0', tone: 'accent' })
  })

  it('toggles the ball window from the tray row and tracks its visibility', async () => {
    const { host, log } = await makeWorld()
    host.emit('shell/tray-clicked', 'production-stats:ball')
    expect(log.presented).toEqual(['ball'])
    // Now the Shell reports the ball on screen, so the same row puts it away.
    host.emit('shell/tray-clicked', 'production-stats:ball')
    expect(log.presented).toEqual(['ball'])
    expect(log.hidden).toEqual(['ball'])
    // The ack row is a local toggle: it flips the checked state, nothing else.
    host.emit('shell/tray-clicked', 'production-stats:handover')
    expect(log.trayUpdated.some(entry => entry.id === 'handover' && entry.patch.checked === true)).toBe(true)
  })

  it('raises an actionable handover notification across a shift boundary', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // 早班 (08:00 local) …
    vi.setSystemTime(new Date(2026, 7, 30, 9, 0, 0))
    const { host, log } = await makeWorld()
    host.settings.set('session.operatorId', 'op-1')
    expect(log.notifications).toHaveLength(0)

    // … then the 中班 boundary (16:00) — a new shift bucket for a live session.
    vi.setSystemTime(new Date(2026, 7, 30, 16, 30, 0))
    host.settings.set('session.operatorId', 'op-2')
    expect(log.notifications).toHaveLength(1)
    const toast = log.notifications[0]!
    expect(toast.title).toBe('班次交接')
    expect(toast.actions?.map(action => action.id)).toEqual(['ack'])
    // The same tag coalesces a repeated handover instead of stacking toasts.
    expect(toast.tag).toBe('shift-handover')

    // The action button acknowledges: the tray reminder clears.
    host.emit('shell/notification-action', 'toast-1', 'ack')
    expect(log.trayUpdated.some(entry => entry.id === 'handover' && entry.patch.checked === true)).toBe(true)
  })
})