// @vitest-environment happy-dom
/**
 * The suite's auxiliary-surface face: the ball window renders the shift count
 * from the host-aggregated frame (never from an equipment point), follows the
 * dock state with a compact tucked tab, and summons the operator window on
 * click. This is the whole chain in one place — surface-aware runtime, the
 * `shell.ball` slot, the frame projection, and the wire calls back to the
 * Shell.
 *
 * @module snap-rail/suite-terminal-ops/tests/surfaces.spec
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@snap-rail/cordis'
import auditPlugin from '@snap-rail/audit'
import gatewayPlugin from '@snap-rail/gateway'
import settingsPlugin from '@snap-rail/settings'
import stationRpcPlugin from '@snap-rail/station-rpc'
import { bootClient } from '@snap-rail/client-kernel'
import type { HostChannel } from '../../connection/src/index.tsx'
import { createClientRuntime } from '@snap-rail/framework-shadcn/runtime'
import ballPlugin from '../src/ball.tsx'
import { afterEach, describe, expect, it } from 'vitest'

const contexts: Context[] = []

afterEach(async () => {
  for (const ctx of contexts.splice(0)) {
    await ctx.fiber.dispose()
    const home = ctx.get('snapRailHome') as string | undefined
    if (home !== undefined) rmSync(home, { recursive: true, force: true })
  }
  document.body.innerHTML = ''
})

interface World {
  channel: HostChannel
  host: Context
}

/** A station world: gateway + settings + audit + the station bridge. */
async function makeWorld(): Promise<World> {
  const host = new Context()
  contexts.push(host)
  host.provide('snapRailHome', mkdtempSync(join(tmpdir(), 'snap-rail-surfaces-')))
  await host.plugin(gatewayPlugin, { name: 'suite-surfaces', version: '0.1.0', bin: 'test' })
  await host.plugin(settingsPlugin)
  await host.plugin(auditPlugin)
  host.provide('pluginLayers', {
    handles: { userLayerPath: join(tmpdir(), 'absent-plugins.yml'), rendererPackages: [] },
  } as never)
  await host.plugin(stationRpcPlugin)
  return {
    host,
    channel: {
      invoke: request => host.rpc.handleClientRequest(request),
      openStream: listener => host.rpc.attachDownlink(frame => listener(frame)),
    },
  }
}

/** The snapshot the host counter broadcasts on every flush cycle. */
const SNAPSHOT = {
  anchor: { operator: 'op-1', loginAt: 1_700_000_000_000, shift: 'morning', shiftKey: '2026-08-30:morning', count: 128 },
  shifts: [{ shiftKey: '2026-08-30:morning', shift: 'morning', date: '2026-08-30', count: 128, updatedAt: 1_700_000_000_000 }],
  hours: [
    { hourStart: 1_700_000_000_000, count: 40 },
    { hourStart: 1_700_003_600_000, count: 44 },
    { hourStart: 1_700_007_200_000, count: 44 },
  ],
}

async function flush(times = 12): Promise<void> {
  for (let i = 0; i < times; i += 1) await new Promise(resolve => setTimeout(resolve, 0))
}

describe('the suite ball face', () => {
  it('projects the aggregated frame onto the orb and summons the operator window', async () => {
    const { host, channel } = await makeWorld()
    const sent: Array<{ method?: unknown, payload?: unknown }> = []
    const spying: HostChannel = {
      invoke: async request => {
        sent.push({ method: request.method, payload: request.payload })
        return channel.invoke(request)
      },
      openStream: channel.openStream,
    }
    const element = document.createElement('div')
    document.body.append(element)
    const handle = await bootClient({ element, channel: spying, surface: 'ball' })
    const runtime = await createClientRuntime(handle, { plugins: [ballPlugin], surface: 'ball' })
    await flush()

    // Before the first frame the orb says so instead of inventing a number.
    expect(document.body.textContent).toContain('未登录')

    host.rpc.broadcast('production/stats-changed', SNAPSHOT)
    await flush()
    expect(document.body.textContent).toContain('128')
    expect(document.body.textContent).toContain('早班')

    document.querySelector<HTMLButtonElement>('button')!.click()
    await flush()
    expect(sent).toContainEqual({ method: 'shell.surface.present', payload: { surface: 'main' } })
    // The face follows the dock state with the same wire (free-floating here).
    expect(sent).toContainEqual({ method: 'shell.ball.dock', payload: {} })

    await runtime.dispose()
    element.remove()
  }, 20_000)

  it('draws the tucked tab while the ball is parked and collapsed', async () => {
    const { host, channel } = await makeWorld()
    const element = document.createElement('div')
    document.body.append(element)
    const handle = await bootClient({ element, channel, surface: 'ball' })
    const runtime = await createClientRuntime(handle, { plugins: [ballPlugin], surface: 'ball' })
    await flush()
    host.rpc.broadcast('production/stats-changed', SNAPSHOT)
    // Park the ball on the right edge, tucked to its visible third.
    host.rpc.broadcast('shell/ball-dock-changed', { edge: 'right', collapsed: true, visiblePx: 43 })
    await flush()

    // The tab replaces the cropped orb and keeps the summon affordance.
    expect(document.body.textContent).toContain('早班')
    const summon = [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.title === '打开主窗口')
    expect(summon).toBeDefined()

    await runtime.dispose()
    element.remove()
  }, 20_000)
})