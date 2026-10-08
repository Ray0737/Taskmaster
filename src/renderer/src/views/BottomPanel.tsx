import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { call } from '../ipc'
import { useApp } from '../stores/app'
import { useTerm, attachWriter, newTerminal, killTerminal } from '../stores/terminal'
import { panels } from '../layout'
import { THEMES } from '../theme/themes'
import { EDITOR_FONT } from '../monaco'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import { Empty } from '../components/Empty'
import { Dropdown } from '../components/Dropdown'

const xtermTheme = () => {
  const u = THEMES[useApp.getState().settings!.theme].ui
  return { background: u['bg-1'], foreground: u.fg, cursor: u.fg, cursorAccent: u['bg-1'], selectionBackground: u.focus }
}

function TermView({ id, active }: { id: number; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const fitRef = useRef<() => void>(() => {})
  useEffect(() => {
    const term = new Terminal({ fontFamily: EDITOR_FONT, fontSize: useApp.getState().settings!.terminalFontSize, cursorBlink: true, theme: xtermTheme(), scrollback: 5000 })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(ref.current!)
    const doFit = () => {
      if (!ref.current?.offsetParent) return // hidden or collapsed
      try { fit.fit(); void call('pty.resize', id, term.cols, term.rows) } catch { /* not measurable yet */ }
    }
    fitRef.current = doFit
    doFit()
    const detach = attachWriter(id, (d) => term.write(d))
    const input = term.onData((d) => void call('pty.write', id, d))
    const ro = new ResizeObserver(doFit)
    ro.observe(ref.current!)
    const unsub = useApp.subscribe((s, p) => {
      if (s.settings?.theme !== p.settings?.theme) term.options.theme = xtermTheme()
      if (s.settings && s.settings.terminalFontSize !== p.settings?.terminalFontSize) { term.options.fontSize = s.settings.terminalFontSize; doFit() }
    })
    return () => { detach(); input.dispose(); ro.disconnect(); unsub(); term.dispose() }
  }, [id])
  useEffect(() => { if (active) fitRef.current() }, [active])
  return <div ref={ref} className="term" hidden={!active} />
}

export function BottomPanel() {
  const t = useT()
  const { list, active, available } = useTerm()
  useEffect(() => { if (!useTerm.getState().list.length && useApp.getState().open.panel) void newTerminal() }, [])
  return (
    <div className="pane panel-area">
      <div className="panel-tabs">
        <span className="panel-tab active">{t('panel.terminal')}</span>
        <div className="flex1" />
        {list.length > 1 && (
          <Dropdown variant="pill" ariaLabel={t('panel.terminal')} value={String(active ?? '')} options={list.map((x) => ({ value: String(x.id), label: x.title }))}
            onChange={(v) => useTerm.setState({ active: Number(v) })} />
        )}
        <div className="pane-actions">
          <button className="icon-btn" title={t('cmd.newTerminal')} aria-label={t('cmd.newTerminal')} onClick={() => void newTerminal()}><Icon name="add" /></button>
          <button className="icon-btn" title={t('panel.kill')} aria-label={t('panel.kill')} disabled={active === null} onClick={() => active !== null && void killTerminal(active)}><Icon name="trash" /></button>
          <button className="icon-btn" title={t('panel.maximize')} aria-label={t('panel.maximize')}
            onClick={() => { const p = panels.panel; if (p) p.resize(p.getSize() > 70 ? 30 : 80) }}><Icon name="chevron-up" /></button>
          <button className="icon-btn" title={t('common.close')} aria-label={t('common.close')} onClick={() => panels.panel?.collapse()}><Icon name="close" /></button>
        </div>
      </div>
      <div className="panel-body">
        {available === false && <Empty text={t('panel.unavailable')} />}
        {list.map((x) => <TermView key={x.id} id={x.id} active={x.id === active} />)}
      </div>
    </div>
  )
}
