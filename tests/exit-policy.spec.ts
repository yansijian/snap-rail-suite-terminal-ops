/**
 * The suite's window policy (`./window`): the host face declares the Shell
 * exit policy from the `terminal.*` settings keys, re-declares when they
 * change, and a tray-sourced exit request summons the operator window so the
 * suite's dialog can ask — putting the ball back when the operator cancels.
 * Driven against a recording fake Shell.
 *
 * @module snap-rail/suite-terminal-ops/tests/exit-policy.spec
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@snap-rail/cordis'
import settingsPlugin from '@snap-rail/settings'
import type {
  BallPatch,
  BallState,
  ShellExitPolicy,
  ShellExitRequest,
  ShellNotificationInput,
  ShellNotificationResult,
  ShellResult,
  ShellService,
  ShellTrayEntry,
  ShellTrayItem,
  ShellTrayItemPatch,
  SurfaceState,
} from '@snap-rail/shell'
import windowPolicyPlugin from '../src/window.ts'
import { afterEach, describe, expect, it } from 'vitest'

const contexts: Context[] = []
const tempDirs: string[] = []

afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** Everything the fake Shell recorded. */
interface Log {
  policies: Array<Partial<ShellExitPolicy>>
  presented: string[]
}

/** A recording Shell adapter with a mutable main/ball visibility. */
function fakeShell(log: Log, visibility: { main: boolean, ball: boolean }): ShellService {
  const entries: ShellTrayEntry[] = []
  let ball: BallState = { progress: null, label: null, tone: 'neutral' }
  const state = (): readonly SurfaceState[] =>
    (['main', 'ball'] as const).map(surface => ({ surface, available: true, visible: visibility[surface] }))
  return {
    available: true,
    notify(): ShellNotificationResult {
      return { applied: true, id: 'toast-1' }
    },
    tray: {
      available: true,
      addItem(_caller, _item: ShellTrayItem): ShellResult {
        return { applied: true }
      },
      updateItem(_caller, _id: string, _patch: ShellTrayItemPatch): ShellResult {
        return { applied: true }
      },
      removeItem(): ShellResult {
        return { applied: true }
      },
      entries: () => entries,
    },
    surface: {
      state,
      present(_caller, surface): ShellResult {
        log.presented.push(surface)
        visibility[surface] = true
        return { applied: true }
      },
      hide(_caller, surface): ShellResult {
        visibility[surface] = false
        return { applied: true }
      },
    },
    ball: {
      state: () => ball,
      setState(_caller, _patch: BallPatch): BallState {
        return ball
      },
    },
    window: {
      setExitPolicy(_caller, policy): ShellResult {
        log.policies.push(policy)
        return { applied: true }
      },
      exitPolicy(): Readonly<ShellExitPolicy> {
        return { close: 'quit', quit: 'quit' }
      },
      resolve(): ShellResult {
        return { applied: true }
      },
    },
  }
}

/** A settings-backed world with the fake Shell mounted. */
async function makeWorld(visibility: { main: boolean, ball: boolean }): Promise<{ host: Context, log: Log }> {
  const home = mkdtempSync(join(tmpdir(), 'snap-rail-exit-policy-'))
  tempDirs.push(home)
  const host = new Context()
  contexts.push(host)
  host.provide('snapRailHome', home)
  await host.plugin(settingsPlugin)
  const log: Log = { policies: [], presented: [] }
  host.provide('shell', fakeShell(log, visibility))
  await host.plugin(windowPolicyPlugin)
  return { host, log }
}

describe('the suite window policy', () => {
  it('declares the shipped defaults: close parks to the ball, the tray quit asks', async () => {
    const { log } = await makeWorld({ main: true, ball: false })
    expect(log.policies).toEqual([{ close: 'ball', quit: 'hold' }])
  })

  it('re-declares when the settings keys change, without waiting for a restart', async () => {
    const { host, log } = await makeWorld({ main: true, ball: false })
    host.settings.set('terminal.closeAction', 'tray')
    expect(log.policies.at(-1)).toEqual({ close: 'tray', quit: 'hold' })
    host.settings.set('terminal.confirmQuit', false)
    expect(log.policies.at(-1)).toEqual({ close: 'tray', quit: 'quit' })
    host.settings.set('terminal.closeAction', 'ask')
    expect(log.policies.at(-1)).toEqual({ close: 'hold', quit: 'quit' })
    // A bogus value is ignored; the last good declaration stands.
    host.settings.set('terminal.closeAction', 'explode')
    expect(log.policies.at(-1)).toEqual({ close: 'hold', quit: 'quit' })
  })

  it('summons the operator window for a tray quit while the app lives in the ball', async () => {
    const visibility = { main: false, ball: true }
    const { host, log } = await makeWorld(visibility)
    host.emit('shell/exit-requested', { source: 'tray' } satisfies ShellExitRequest)
    expect(log.presented).toEqual(['main'])
    expect(visibility.main).toBe(true)

    // The operator cancelled: the screen goes back to the ball it came from.
    host.emit('shell/exit-resolved', { source: 'tray' }, 'cancel')
    expect(log.presented).toEqual(['main', 'ball'])
  })

  it('leaves a visible operator window alone on a tray quit', async () => {
    const { host, log } = await makeWorld({ main: true, ball: false })
    host.emit('shell/exit-requested', { source: 'tray' })
    expect(log.presented).toEqual([])
    host.emit('shell/exit-resolved', { source: 'tray' }, 'quit')
    expect(log.presented).toEqual([])
  })
})
