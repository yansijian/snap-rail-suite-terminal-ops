/**
 * The suite's window policy: what closing the client and quitting from the
 * tray do, declared on the Shell seam and steered by two settings keys
 * (`terminal.closeAction`, `terminal.confirmQuit`) that the suite's own
 * 「窗口与退出」 settings page writes.
 *
 * The base never paints a prompt. When the policy is `hold`, the Shell
 * freezes the request and this package answers it: the renderer face
 * (`./exit-prompt`) shows the suite's own dialog, and this host face makes
 * that possible when the window is away — a tray quit while the app lives in
 * the floating ball first summons the operator window (and puts the ball back
 * if the operator cancels).
 *
 * @module @snap-rail/suite-terminal-ops/window
 */

import { Context, type Plugin } from '@snap-rail/cordis'
import type { SettingsService } from '@snap-rail/settings'
import type { ShellService } from '@snap-rail/shell'
import '@snap-rail/shell'
import type { CloseAction } from './contract.ts'
import {
  CLOSE_ACTION_KEY,
  CONFIRM_QUIT_KEY,
  DEFAULT_CLOSE_ACTION,
  DEFAULT_CONFIRM_QUIT,
  closeActionSchema,
} from './contract.ts'

/** The window policy plugin; mounted beside `./stats` on the host face. */
const windowPolicyPlugin: Plugin.Object<void> = {
  name: 'terminal-window-policy',
  inject: ['settings'],
  apply(ctx: Context): void {
    const settings: SettingsService = ctx.settings
    // The OS seam is optional: a headless or test host mounts no Shell
    // adapter, and then there is no window policy to declare.
    const shell = ctx.get('shell') as ShellService | undefined
    if (shell === undefined) return

    let declared = ''
    let closeAction: CloseAction = DEFAULT_CLOSE_ACTION
    let confirmQuit = DEFAULT_CONFIRM_QUIT
    const adopt = (): void => {
      // A missing key means the shipped default; a *stored but invalid* value
      // (hand-edited settings.json) leaves the current behavior standing —
      // garbage must not silently change what the operator's X does.
      const storedClose = settings.get<unknown>(CLOSE_ACTION_KEY)
      if (storedClose === undefined) closeAction = DEFAULT_CLOSE_ACTION
      else {
        const parsed = closeActionSchema.safeParse(storedClose)
        if (parsed.success) closeAction = parsed.data
      }
      const storedConfirm = settings.get<unknown>(CONFIRM_QUIT_KEY)
      if (storedConfirm === undefined) confirmQuit = DEFAULT_CONFIRM_QUIT
      else if (typeof storedConfirm === 'boolean') confirmQuit = storedConfirm

      const want = JSON.stringify({ closeAction, confirmQuit })
      if (want === declared) return
      declared = want
      const applied = shell.window.setExitPolicy(ctx, {
        close: closeAction === 'ask' ? 'hold' : closeAction,
        quit: confirmQuit ? 'hold' : 'quit',
      })
      if (!applied.applied) ctx.logger('terminal-window').warn(`窗口退出策略未生效：${applied.message}`)
    }
    adopt()

    ctx.effect(() => {
      const dropSettings = ctx.on('settings/changed', key => {
        if (key === CLOSE_ACTION_KEY || key === CONFIRM_QUIT_KEY) adopt()
      })

      // A quit from the tray must be askable: the dialog lives in the
      // renderer, so an away window is summoned first. The previous screen
      // comes back if the operator cancels.
      let summonedMain = false
      let ballWasVisible = false
      const dropRequest = ctx.on('shell/exit-requested', request => {
        if (request.source !== 'tray') return
        const state = shell.surface.state().find(entry => entry.surface === 'main')
        if (state === undefined || state.visible) return
        ballWasVisible = shell.surface.state().find(entry => entry.surface === 'ball')?.visible ?? false
        summonedMain = shell.surface.present(ctx, 'main').applied
      })
      const dropResolved = ctx.on('shell/exit-resolved', (_request, action) => {
        if (!summonedMain) return
        summonedMain = false
        const restoreBall = ballWasVisible
        ballWasVisible = false
        if (action === 'cancel' && restoreBall) shell.surface.present(ctx, 'ball')
      })

      return () => {
        dropSettings()
        dropRequest()
        dropResolved()
      }
    })
  },
}

export default windowPolicyPlugin
