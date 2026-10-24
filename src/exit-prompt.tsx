/**
 * The suite's exit prompt: the one dialog a `hold` in the window policy
 * waits for. The base intercepts the close (or the tray's 退出), freezes the
 * request, and broadcasts `shell/exit-requested`; this face answers with the
 * operator's choice through `shell.exit.resolve` — the base itself never
 * paints a prompt, by design.
 *
 * Buttons mirror the policy's dispositions: 最小化到悬浮球 keeps the
 * terminal alive in the ball (the count keeps running), 退出程序 ends it,
 * 取消 closes nothing.
 *
 * @module @snap-rail/suite-terminal-ops/exit-prompt
 */

import type { Plugin } from '@snap-rail/cordis'
import { subscribeFrame, type HostLink } from '@snap-rail/connection'
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@snap-rail/framework-shadcn/ui'
import '@snap-rail/framework-shadcn/semantic'
import { useEffect, useState, type ReactNode } from 'react'
import { shellContract, type ShellExitSource } from '@snap-rail/shell/contract'

/** The pending request this face is asking about, or `null`. */
interface Pending {
  source: ShellExitSource
}

/** One stable sender: a late answer after teardown must not throw unhandled. */
function resolveRequest(link: HostLink, action: 'ball' | 'tray' | 'quit' | 'cancel'): void {
  void link.call('shell.exit.resolve', { action }).catch(() => {})
}

/** The dialog itself: one pending request, three answers. */
function ExitDialog(props: { pending: Pending, onResolve: (action: 'ball' | 'tray' | 'quit' | 'cancel') => void }): ReactNode {
  return (
    <Dialog open onOpenChange={open => { if (!open) props.onResolve('cancel') }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">退出客户端？</DialogTitle>
          <DialogDescription>
            关闭后生产、抽检与异常记录入口将不可用；未提交的数据已随操作落盘。
            {props.pending.source === 'tray' ? '（来自托盘「退出」）' : ''}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => props.onResolve('cancel')}>取消</Button>
          <Button variant="secondary" size="lg" onClick={() => props.onResolve('ball')}>最小化到悬浮球</Button>
          <Button variant="destructive" size="lg" onClick={() => props.onResolve('quit')}>退出程序</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The prompt: invisible until a held exit request arrives, then a modal over
 * whatever page is up. The subscription is the component's own, exactly like
 * the pages' frame projections.
 */
function ExitPrompt(props: { link: HostLink }): ReactNode {
  const [pending, setPending] = useState<Pending | null>(null)
  useEffect(() => subscribeFrame(props.link, 'shell/exit-requested', shellContract.frames['shell/exit-requested'], request => {
    setPending(request)
  }), [props.link])
  if (pending === null) return null
  return (
    <ExitDialog
      pending={pending}
      onResolve={action => {
        setPending(null)
        resolveRequest(props.link, action)
      }}
    />
  )
}

/** The exit-prompt plugin: a layout occupant that answers held exit requests. */
const exitPromptPlugin: Plugin.Object<void> = {
  name: 'suite-terminal-ops/exit-prompt',
  inject: ['uiContract', 'client'],
  apply(ctx): void {
    // A stacked layout occupant beside the station layout — the same seat the
    // framework's settings dialog uses. It renders `null` until a request is
    // held, so it never paints anything of its own.
    ctx.uiContract.registerLayout(ctx, {
      id: 'suite-exit-prompt',
      order: 101,
      slots: [],
      render: (): ReactNode => <ExitPrompt link={ctx.client.link} />,
    })
  },
}

export default exitPromptPlugin
