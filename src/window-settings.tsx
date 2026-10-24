/**
 * The suite's 「窗口与退出」 settings page: the operator-facing knobs for the
 * window policy that `./window` declares on the Shell seam.
 *
 * - 关闭客户端时：最小化到悬浮球（计数继续在球上跑）/ 隐藏到托盘 /
 *   每次询问（关闭时本套件的对话框确认一次）。
 * - 托盘退出时确认：托盘「退出」先经同一对话框，还是直接退出。
 *
 * Values live in settings.json (`terminal.*`), so a change hot-applies
 * through `settings/changed` — no restart, and the plugin author's default is
 * what ships until the operator moves a knob.
 *
 * @module @snap-rail/suite-terminal-ops/window-settings
 */

import type { Plugin } from '@snap-rail/cordis'
import { subscribeFrame, type HostLink } from '@snap-rail/connection'
import { Card, CardContent, Label, Switch, TouchSelect, type TouchSelectOption } from '@snap-rail/framework-shadcn/ui'
import '@snap-rail/framework-shadcn/settings-pages'
import { settingsChangedSchema } from '@snap-rail/station-rpc/contract'
import { useEffect, useState, type ReactNode } from 'react'
import {
  CLOSE_ACTION_KEY,
  CONFIRM_QUIT_KEY,
  DEFAULT_CLOSE_ACTION,
  DEFAULT_CONFIRM_QUIT,
  closeActionSchema,
  type CloseAction,
} from './contract.ts'

/** The close actions in operator vocabulary. */
const CLOSE_LABELS: Readonly<Record<CloseAction, string>> = {
  ball: '最小化到悬浮球',
  tray: '隐藏到托盘',
  ask: '每次询问',
}

const CLOSE_OPTIONS: readonly TouchSelectOption[] = [
  { value: 'ball', label: CLOSE_LABELS.ball },
  { value: 'tray', label: CLOSE_LABELS.tray },
  { value: 'ask', label: CLOSE_LABELS.ask },
]

/** The page body: two knobs bound to settings.json. */
function WindowSettingsPage(props: { link: HostLink }): ReactNode {
  const [closeAction, setCloseAction] = useState<CloseAction>(DEFAULT_CLOSE_ACTION)
  const [confirmQuit, setConfirmQuit] = useState(DEFAULT_CONFIRM_QUIT)

  useEffect(() => {
    const link = props.link
    const adopt = (close: unknown, confirm: unknown): void => {
      const parsedClose = closeActionSchema.safeParse(close)
      if (parsedClose.success) setCloseAction(parsedClose.data)
      if (typeof confirm === 'boolean') setConfirmQuit(confirm)
    }
    // The page renders with the defaults and adopts the persisted values the
    // moment the host answers; later writes arrive as `settings/changed`.
    void Promise.all([
      link.call('settings.get', { key: CLOSE_ACTION_KEY }),
      link.call('settings.get', { key: CONFIRM_QUIT_KEY }),
    ])
      .then(([close, confirm]) => {
        adopt(close.ok ? close.value.value : undefined, confirm.ok ? confirm.value.value : undefined)
      })
      .catch(() => {})
    return subscribeFrame(link, 'settings/changed', settingsChangedSchema, change => {
      if (change.key === CLOSE_ACTION_KEY) adopt(change.value, undefined)
      if (change.key === CONFIRM_QUIT_KEY) adopt(undefined, change.value)
    })
  }, [props.link])

  const saveClose = (value: string): void => {
    const parsed = closeActionSchema.safeParse(value)
    if (!parsed.success) return
    setCloseAction(parsed.data)
    void props.link.call('settings.set', { key: CLOSE_ACTION_KEY, value: parsed.data }).catch(() => {})
  }

  const saveConfirm = (checked: boolean): void => {
    setConfirmQuit(checked)
    void props.link.call('settings.set', { key: CONFIRM_QUIT_KEY, value: checked }).catch(() => {})
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label>关闭客户端时</Label>
          <TouchSelect
            label="关闭客户端时"
            value={closeAction}
            options={CLOSE_OPTIONS}
            onValueChange={saveClose}
          />
          <p className="text-sm text-muted-foreground">
            {CLOSE_LABELS[closeAction]}——主窗口与悬浮球互斥，收起后计数继续在球上运行。
          </p>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="terminal-confirm-quit">托盘退出时确认</Label>
          <Switch
            id="terminal-confirm-quit"
            checked={confirmQuit}
            onCheckedChange={saveConfirm}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          开启后，托盘「退出」先弹确认框；关闭则立即退出。
        </p>
      </CardContent>
    </Card>
  )
}

/** The settings-page plugin: one 「窗口与退出」 page in the settings dialog. */
const windowSettingsPlugin: Plugin.Object<void> = {
  name: 'suite-terminal-ops/window-settings',
  inject: ['uiSlots', 'client', 'settingsPages'],
  apply(ctx): void {
    ctx.settingsPages.register(ctx, {
      id: 'window',
      title: '窗口与退出',
      order: 30,
      render(): ReactNode {
        return <WindowSettingsPage link={ctx.client.link} />
      },
    })
  },
}

export default windowSettingsPlugin
