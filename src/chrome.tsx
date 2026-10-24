/**
 * Resident frameless-window titlebar: logo and title on the left inside a
 * drag region; on the right the signed-on operator with sign-off, then the
 * settings button and minimize / maximize / close as full-height flush
 * buttons (no gaps to the top or right edges). Close rides the host's exit
 * policy through `window.control close` — the suite declares that policy
 * (`./window`), and when it holds the close, the suite's own dialog
 * (`./exit-prompt`) asks.
 *
 * The settings button only raises the dialog (`open()`); its contents live
 * behind the settings seam.
 *
 * @module @snap-rail/suite-terminal-ops/chrome
 */

import { Context, type Plugin } from '@snap-rail/cordis'
import { Disc, LogOut, Minus, Settings, Square, X } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { Button, useRefresh } from '@snap-rail/framework-shadcn/ui'
import '@snap-rail/framework-shadcn/slots'
import { UI_SLOT_IDS } from '@snap-rail/framework-shadcn/slots'
import '@snap-rail/framework-shadcn/runtime'
import '@snap-rail/framework-shadcn/session'
import '@snap-rail/framework-shadcn/settings-pages'

type Action = 'minimize' | 'toggle-maximize' | 'close'

/** A minimal rail-track mark; inline so the chrome carries no asset files. */
function LogoMark(): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 text-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M7 4v16" />
      <path d="M17 4v16" />
      <path d="M5 9h14" />
      <path d="M5 15h14" />
    </svg>
  )
}

function Titlebar(props: {
  ctx: Context
  control: (action: Action) => void
  presentSurface: (surface: 'ball') => void
}): ReactNode {
  // Slot-changed keeps the shell.titlebar.actions region (forge's AI button) live.
  useRefresh(props.ctx, ['session/changed', 'ui/slot-changed'])

  const operator = props.ctx.session.current()

  return (
    <div className="drag-region relative flex h-14 select-none items-stretch justify-between border-b border-border">
      <div className="flex items-center gap-3 pl-4">
        <LogoMark />
        <span className="text-base font-medium tracking-wide">snap-rail</span>
      </div>

      <div className="no-drag flex items-stretch">
        {operator !== null && (
          <div className="mr-1 flex items-center gap-1 pr-1">
            <span
              className="inline-flex h-8 items-center rounded border border-border px-3 font-mono text-sm text-muted-foreground"
              data-operator={operator}
            >
              {operator}
            </span>
            <Button
              variant="ghost"
              className="h-10 px-3 text-sm text-muted-foreground"
              onClick={() => { void props.ctx.session.logout().catch(() => {}) }}
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </Button>
          </div>
        )}

        <div className="flex items-stretch">
          {/* Occupant-contributed icon buttons (flush styling is the
           * occupant's contract) — the forge studio's AI 创造 entry. */}
          {props.ctx.uiSlots.list(UI_SLOT_IDS.titlebarActions).map(occupant => (
            <Fragment key={occupant.id}>{occupant.render()}</Fragment>
          ))}
          {/* The floating ball is operator-reachable from here: a renderer may
           * ask the Shell to bring the window up, and `present` is idempotent
           * (already on screen → no-op). Presenting the ball also parks the
           * operator window — the two exclude each other by the base's rule. */}
          <Button
            variant="ghost"
            aria-label="悬浮球"
            title="悬浮球（可拖动，靠边自动收起，点击球心回主窗口）"
            className="h-full w-14 rounded-none px-0"
            onClick={() => props.presentSurface('ball')}
          >
            <Disc className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            aria-label="设置"
            className="h-full w-14 rounded-none px-0"
            onClick={() => props.ctx.settingsPages.open()}
          >
            <Settings className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            aria-label="最小化"
            className="h-full w-14 rounded-none px-0"
            onClick={() => props.control('minimize')}
          >
            <Minus className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            aria-label="最大化切换"
            className="h-full w-14 rounded-none px-0"
            onClick={() => props.control('toggle-maximize')}
          >
            <Square className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            aria-label="关闭"
            className="h-full w-14 rounded-none px-0 rounded-r-none hover:bg-destructive/20 hover:text-destructive"
            onClick={() => props.control('close')}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/** The titlebar occupant. */
const titlebarPlugin: Plugin.Object<void> = {
  name: 'chrome-titlebar',
  inject: ['uiSlots', 'client', 'session', 'settingsPages'],
  apply(ctx: Context): void {
    // One stable sender for the plugin lifetime; late fires after teardown
    // must not surface as unhandled rejections.
    const control = (action: Action): void => {
      void ctx.client.link.call('window.control', { action }).catch(() => {})
    }
    // Auxiliary-surface control rides the Shell wire contract (no Electron
    // here): the Shell creates the window on first present and keeps it.
    const presentSurface = (surface: 'ball'): void => {
      void ctx.client.link.call('shell.surface.present', { surface }).catch(() => {})
    }
    ctx.uiSlots.register(ctx, UI_SLOT_IDS.titlebar, {
      id: 'chrome',
      order: 0,
      render(): ReactNode {
        return <Titlebar ctx={ctx} control={control} presentSurface={presentSurface} />
      },
    })
  },
}

export default titlebarPlugin
