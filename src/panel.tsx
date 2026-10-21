/**
 * The suite's mini-panel face: a 360×480 floating card with the shift count,
 * the hour trend, and the two actions a satellite window needs (open the
 * operator window, put the panel away).
 *
 * Like the ball, it reads the **host-aggregated** `production/stats-changed`
 * frame — never an equipment point — and it occupies `shell.panel` in the panel
 * window. The Shell hides this window on blur and on Escape; the explicit
 * 「收起」 button is the touch-friendly equivalent.
 *
 * @module @snap-rail/suite-terminal-ops/panel
 */

import type { Plugin } from '@snap-rail/cordis'
import { subscribeFrame, type HostLink } from '@snap-rail/connection'
import { UI_SLOT_IDS } from '@snap-rail/framework-shadcn/slots'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
// Brings the `shell.*` rows into this program's type surface (see ball.tsx).
import type {} from '@snap-rail/shell/contract'
import { SHIFT_CAPTION, productionStatsSnapshotSchema, type ProductionStatsSnapshot } from './contract.ts'

/** `HH:00` of an hour-aligned epoch (the bucket label). */
function hourLabel(hourStart: number): string {
  return `${String(new Date(hourStart).getHours()).padStart(2, '0')}:00`
}

/** One labelled value row in the card body. */
function Row(props: { label: string, value: string }): ReactNode {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--color-muted-foreground)' }}>{props.label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{props.value}</span>
    </div>
  )
}

/** The mini panel: live count, the newest three hour buckets, two actions. */
function CountPanel(props: { link: HostLink }): ReactNode {
  const [snapshot, setSnapshot] = useState<ProductionStatsSnapshot | null>(null)

  useEffect(() => {
    const drop = subscribeFrame(props.link, 'production/stats-changed', productionStatsSnapshotSchema, next => {
      setSnapshot(next)
    })
    return () => { drop() }
  }, [props.link])

  const anchor = snapshot?.anchor ?? null
  const hours = (snapshot?.hours ?? []).slice(-3)

  const card: CSSProperties = {
    width: 344,
    height: 464,
    boxSizing: 'border-box',
    borderRadius: 14,
    border: '1px solid var(--color-border)',
    background: 'var(--color-card)',
    color: 'var(--color-card-foreground)',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: 20,
    fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
  }
  const action: CSSProperties = {
    flex: 1,
    height: 36,
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: 'var(--color-secondary)',
    color: 'var(--color-secondary-foreground)',
    fontSize: 13,
    cursor: 'pointer',
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>班产</span>
          <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>
            {anchor === null ? '未登录' : SHIFT_CAPTION[anchor.shift]}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ fontSize: 44, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {anchor === null ? '—' : anchor.count}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)', paddingBottom: 4 }}>件</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflow: 'auto' }}>
          <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>近三小时</span>
          {hours.length === 0
            ? <span style={{ fontSize: 13, color: 'var(--color-muted-foreground)' }}>暂无数据</span>
            : hours.map(bucket => (
              <Row key={bucket.hourStart} label={hourLabel(bucket.hourStart)} value={String(bucket.count)} />
            ))}
          {anchor === null
            ? null
            : <Row label="本班" value={String(anchor.count)} />}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={action} onClick={() => void props.link.call('shell.surface.present', { surface: 'main' })}>
            打开主窗口
          </button>
          <button type="button" style={action} onClick={() => void props.link.call('shell.surface.hide', { surface: 'panel' })}>
            收起
          </button>
        </div>
      </div>
    </div>
  )
}

/** The panel face plugin: one occupant of `shell.panel`. */
const panelPlugin: Plugin.Object<void> = {
  name: 'suite-terminal-ops/panel',
  inject: ['uiSlots', 'client'],
  apply(ctx): void {
    ctx.uiSlots.register(ctx, UI_SLOT_IDS.panel, {
      id: 'suite-count-panel',
      order: 10,
      render: (): ReactNode => <CountPanel link={ctx.client.link} />,
    })
  },
}

export default panelPlugin