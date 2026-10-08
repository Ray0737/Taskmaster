import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AgentMode } from '@shared/types'
import { call } from '../ipc'
import { useApp } from '../stores/app'
import { useAgent } from '../stores/agent'
import { registerCommand } from '../commands'
import { showPanel } from '../layout'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import { Empty } from '../components/Empty'
import { agentHeaderExtras, agentFooterExtras } from './registry'
import { Message } from './AgentMessages'
import { HelpIcon } from './HelpIcon'

let focusInput: (() => void) | null = null
registerCommand({
  id: 'agent.focus', title: 'cmd.focusAgent', keys: 'Ctrl+L',
  run: () => { showPanel('agent'); setTimeout(() => focusInput?.(), 50) }
})

const fmt = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
const MODES: AgentMode[] = ['plan', 'acceptEdits', 'bypassPermissions']

function RunStatus() {
  const t = useT()
  const startedAt = useAgent((s) => s.startedAt)
  const [, tick] = useState(0)
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(i) }, [])
  return <span>{t('agent.working', { sec: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0 })}</span>
}

function ContextDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const system = useAgent((s) => s.system)
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal" style={{ width: 560 }} role="dialog" aria-modal="true" aria-label={t('agent.contextTitle')}
        onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div className="modal-title">{t('agent.contextTitle')}</div>
        <pre className="tool-detail mono" style={{ whiteSpace: 'pre-wrap', maxHeight: '50vh', margin: 0 }}>{system || t('agent.contextNone')}</pre>
        <div className="modal-actions"><button autoFocus className="btn" onClick={onClose}>{t('common.close')}</button></div>
      </div>
    </div>
  )
}

export function AgentPanel() {
  const t = useT()
  const root = useApp((s) => s.root)
  const { agents, detected, agentId, mode, items, runId, usage } = useAgent()
  const agent = agents.find((a) => a.id === agentId)
  const [text, setText] = useState('')
  const [ctx, setCtx] = useState(false)
  const [stick, setStick] = useState(true)
  const msgs = useRef<HTMLDivElement>(null)
  const ta = useRef<HTMLTextAreaElement>(null)
  const running = runId !== null
  const canSend = !!root && !!agent && !running

  useEffect(() => { if (!useAgent.getState().detected) void useAgent.getState().detect() }, [])
  useEffect(() => { focusInput = () => ta.current?.focus(); return () => { focusInput = null } }, [])
  useLayoutEffect(() => { if (stick && msgs.current) msgs.current.scrollTop = msgs.current.scrollHeight }, [items, stick])
  useLayoutEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.4)}px`
  }, [text])

  const submit = () => {
    const v = text.trim()
    if (!v || !canSend) return
    setText('')
    setStick(true)
    void useAgent.getState().send(v)
  }

  return (
    <div className="pane">
      <div className="pane-title">
        <span className="ellipsis">{t('agent.title')}</span>
        <div className="pane-actions">
          <HelpIcon chapter="06-agents.md" />
          <button className="icon-btn" title={t('agent.newChat')} aria-label={t('agent.newChat')} onClick={() => void useAgent.getState().newChat()}><Icon name="add" /></button>
        </div>
      </div>
      {detected && agents.length === 0 ? (
        <Empty text={t('agent.none')}>
          <div className="dim">{t('agent.noneHelp')}</div>
          <button className="btn btn-primary" onClick={() => void call('shell.openExternal', 'https://docs.claude.com/en/docs/claude-code/overview')}>{t('agent.install')}</button>
          <button className="btn" onClick={() => void useAgent.getState().detect()}>{t('agent.rescan')}</button>
        </Empty>
      ) : (
        <>
          <div className="agent-head">
            <select className="select select-inline" aria-label={t('agent.select')} disabled={running} value={agentId ?? ''}
              onChange={(e) => useAgent.getState().setAgent(e.target.value)}>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.label}{a.kind === 'basic' ? ` (${t('agent.basic')})` : ''}</option>)}
            </select>
            {agent?.kind === 'claude' && (
              <select className="select select-inline" aria-label={t('agent.mode')} disabled={running} value={mode}
                onChange={(e) => useAgent.getState().setMode(e.target.value as AgentMode)}>
                {MODES.map((m) => <option key={m} value={m}>{t(`agent.mode.${m}`)}</option>)}
              </select>
            )}
            {agentHeaderExtras.map((X, i) => <X key={i} />)}
            <button className="btn" style={{ height: 24 }} onClick={() => setCtx(true)}><Icon name="info" />{t('agent.context')}</button>
          </div>
          {agent?.kind === 'claude' && mode === 'bypassPermissions' && <div className="danger small" style={{ padding: '0 8px 6px' }}>{t('agent.mode.fullWarning')}</div>}
          <div className="agent-body">
            <div ref={msgs} className="agent-msgs"
              onScroll={(e) => { const el = e.currentTarget; setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 40) }}>
              {items.map((i) => <Message key={i.id} item={i} />)}
            </div>
            {!stick && items.length > 0 && (
              <button className="btn new-msgs" onClick={() => { setStick(true) }}><Icon name="arrow-down" />{t('agent.newMessages')}</button>
            )}
          </div>
          <div className="agent-foot">
            {agentFooterExtras.map((X, i) => <X key={i} />)}
            <div className="agent-status">
              <span>{running ? <RunStatus /> : usage
                ? t('agent.usage', { inTokens: fmt(usage.inTokens), outTokens: fmt(usage.outTokens) }) + (usage.costUsd != null ? t('agent.cost', { cost: usage.costUsd.toFixed(2) }) : '')
                : t('agent.ready')}</span>
            </div>
            <div className="agent-input">
              <textarea ref={ta} className="textarea" rows={1} value={text} disabled={!root || !agent} aria-label={t('agent.placeholder')}
                placeholder={root ? t('agent.placeholder') : t('agent.needProject')}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }} />
              {running
                ? <button className="btn btn-danger" onClick={() => void useAgent.getState().stop()}><Icon name="debug-stop" />{t('agent.stop')}</button>
                : <button className="btn btn-primary" disabled={!canSend || !text.trim()} onClick={submit}><Icon name="send" />{t('agent.send')}</button>}
            </div>
          </div>
        </>
      )}
      {ctx && <ContextDialog onClose={() => setCtx(false)} />}
    </div>
  )
}
