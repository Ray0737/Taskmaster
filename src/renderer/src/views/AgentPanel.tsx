import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AgentMode } from '@shared/types'
import type { PastSession } from '@shared/transcript'
import { PROMPT_CAP } from '@shared/prompt'
import { call } from '../ipc'
import { useApp } from '../stores/app'
import { useAgent } from '../stores/agent'
import { toast } from '../stores/ui'
import { registerCommand, runCommand } from '../commands'
import { showPanel } from '../layout'
import { useT } from '../i18n'
import { ago } from '../util'
import { Icon } from '../components/Icon'
import { Empty } from '../components/Empty'
import { Dropdown } from '../components/Dropdown'
import { agentHeaderExtras, agentFooterExtras } from './registry'
import { Message } from './AgentMessages'
import { HelpIcon } from './HelpIcon'
import { openManual } from './ManualTab'

let focusInput: (() => void) | null = null
registerCommand({
  id: 'agent.focus', title: 'cmd.focusAgent', keys: 'Ctrl+L',
  run: () => { showPanel('agent'); setTimeout(() => focusInput?.(), 50) }
})

const fmt = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
const MODES: AgentMode[] = ['plan', 'acceptEdits', 'bypassPermissions']
const MODE_ICON: Record<AgentMode, string> = { plan: 'eye', acceptEdits: 'edit', bypassPermissions: 'warning' }

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
  const [copied, setCopied] = useState(false)
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal modal-lg" role="dialog" aria-modal="true" aria-label={t('agent.contextTitle')}
        onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div className="dialog-head">
          <Icon name="info" className="dialog-icon" />
          <div>
            <div className="modal-title">{t('agent.contextTitle')}</div>
            <div className="dim small">{t('agent.context.sub')}</div>
          </div>
        </div>
        {system ? (
          <>
            <div className="ctx-meta">
              <span className="dim small">{t('agent.context.size', { n: system.length, max: PROMPT_CAP })}</span>
              <button className="btn btn-small btn-soft" onClick={() => { void navigator.clipboard.writeText(system); setCopied(true); setTimeout(() => setCopied(false), 1200) }}>
                <Icon name={copied ? 'check' : 'copy'} />{copied ? t('agent.copied') : t('agent.copy')}
              </button>
            </div>
            <div className="ctx-body selectable">{system}</div>
          </>
        ) : (
          <div className="empty-center ctx-empty">
            <Icon name="comment-discussion" className="empty-icon" />
            <div className="empty-title">{t('agent.context.emptyTitle')}</div>
            <div className="dim">{t('agent.context.emptyHint')}</div>
            <button className="btn" onClick={() => { onClose(); runCommand('view.tasks') }}><Icon name="checklist" />{t('agent.context.openTasks')}</button>
          </div>
        )}
        <div className="modal-actions"><button autoFocus className="btn btn-primary" onClick={onClose}>{t('common.close')}</button></div>
      </div>
    </div>
  )
}

function SessionRow({ s, onPick }: { s: PastSession; onPick: (s: PastSession) => void }) {
  const t = useT()
  const lang = useApp((x) => x.settings!.lang)
  return (
    <button className="row row-tall session-row" title={s.title} onClick={() => onPick(s)}>
      <Icon name="comment" />
      <span className="session-text">
        <span className="ellipsis">{s.title}</span>
        <span className="dim small ellipsis">{t('agent.history.messages', { n: s.messages })} · {ago(s.at, lang)}</span>
      </span>
    </button>
  )
}

async function resumeSession(s: PastSession, t: (k: string, v?: Record<string, string | number>) => string): Promise<boolean> {
  try { await useAgent.getState().resume(s.id); toast(t('agent.history.resumed', { title: s.title })); return true } catch { toast(t('agent.history.failed'), 'error'); return false }
}

function HistoryDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const history = useAgent((s) => s.history)
  const [q, setQ] = useState('')
  useEffect(() => { void useAgent.getState().loadHistory() }, [])
  const shown = (history ?? []).filter((s) => s.title.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal modal-lg" role="dialog" aria-modal="true" aria-label={t('agent.history')}
        onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div className="dialog-head">
          <Icon name="history" className="dialog-icon" />
          <div>
            <div className="modal-title">{t('agent.history')}</div>
            <div className="dim small">{t('agent.history.sub')}</div>
          </div>
        </div>
        <input autoFocus className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('agent.history.search')} aria-label={t('agent.history.search')} />
        {history && history.length > 0 && <div className="dim small">{t('agent.history.count', { n: shown.length })}</div>}
        <div className="repo-list scroll" role="list">
          {history === null && <div className="empty-row dim">{t('welcome.checking')}</div>}
          {history && history.length === 0 && <div className="empty-row dim">{t('agent.history.empty')}</div>}
          {history && history.length > 0 && shown.length === 0 && <div className="empty-row dim">{t('agent.history.noMatch')}</div>}
          {shown.map((s) => <SessionRow key={s.id} s={s} onPick={async (x) => { if (await resumeSession(x, t)) onClose() }} />)}
        </div>
        <div className="modal-actions"><button className="btn btn-primary" onClick={onClose}>{t('common.close')}</button></div>
      </div>
    </div>
  )
}

function AgentEmpty({ canHistory, onHistory }: { canHistory: boolean; onHistory: () => void }) {
  const t = useT()
  const root = useApp((s) => s.root)
  const history = useAgent((s) => s.history)
  const recent = (history ?? []).slice(0, 3)
  return (
    <div className="empty-center agent-empty">
      <Icon name="hubot" className="empty-icon" />
      <div className="empty-title">{t('agent.empty.title')}</div>
      <div className="dim">{root ? t('agent.empty.hint') : t('agent.needProject')}</div>
      <div className="empty-actions">
        {canHistory && <button className="btn" onClick={onHistory}><Icon name="history" />{t('agent.history')}</button>}
        <button className="btn" onClick={() => openManual('06-agents.md')}><Icon name="book" />{t('cmd.manual')}</button>
      </div>
      {canHistory && recent.length > 0 && (
        <div className="recent-sessions">
          <div className="small dim recent-title">{t('agent.history.recent')}</div>
          {recent.map((s) => <SessionRow key={s.id} s={s} onPick={(x) => void resumeSession(x, t)} />)}
        </div>
      )}
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
  const [hist, setHist] = useState(false)
  const [stick, setStick] = useState(true)
  const msgs = useRef<HTMLDivElement>(null)
  const ta = useRef<HTMLTextAreaElement>(null)
  const running = runId !== null
  const canSend = !!root && !!agent && !running
  const canHistory = agent?.kind === 'claude' && !!root

  useEffect(() => { if (!useAgent.getState().detected) void useAgent.getState().detect() }, [])
  useEffect(() => { if (canHistory) void useAgent.getState().loadHistory() }, [canHistory, root])
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

  const status = running ? <RunStatus />
    : usage
      ? <span>{t('agent.usage', { inTokens: fmt(usage.inTokens), outTokens: fmt(usage.outTokens) }) + (usage.costUsd != null ? t('agent.cost', { cost: usage.costUsd.toFixed(2) }) : '')}</span>
      : <span>{t('agent.ready')}</span>

  return (
    <div className="pane">
      <div className="pane-title">
        <Icon name="hubot" />
        <span className="ellipsis">{t('agent.title')}</span>
        <div className="pane-actions">
          {canHistory && <button className="icon-btn" title={t('agent.history')} aria-label={t('agent.history')} onClick={() => setHist(true)}><Icon name="history" /></button>}
          <HelpIcon chapter="06-agents.md" />
          <button className="icon-btn" title={t('agent.newChat')} aria-label={t('agent.newChat')} onClick={() => void useAgent.getState().newChat()}><Icon name="add" /></button>
        </div>
      </div>
      {detected && agents.length === 0 ? (
        <Empty text={t('agent.none')}>
          <div className="dim">{t('agent.noneHelp')}</div>
          <button className="btn btn-primary" onClick={() => void call('shell.openExternal', 'https://docs.claude.com/en/docs/claude-code/overview')}>{t('agent.install')}</button>
          <button className="btn" onClick={() => void useAgent.getState().detect()}><Icon name="refresh" />{t('agent.rescan')}</button>
        </Empty>
      ) : (
        <>
          <div className="agent-body">
            <div ref={msgs} className="agent-msgs"
              onScroll={(e) => { const el = e.currentTarget; setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 40) }}>
              {items.length === 0 ? <AgentEmpty canHistory={canHistory} onHistory={() => setHist(true)} /> : items.map((i) => <Message key={i.id} item={i} />)}
            </div>
            {!stick && items.length > 0 && (
              <button className="btn new-msgs" onClick={() => { setStick(true) }}><Icon name="arrow-down" />{t('agent.newMessages')}</button>
            )}
          </div>
          {root && <div className="agent-foot">
            {agentFooterExtras.map((X, i) => <X key={i} />)}
            {agent?.kind === 'claude' && mode === 'bypassPermissions' && <div className="danger small">{t('agent.mode.fullWarning')}</div>}
            <div className="composer agent-input">
              <textarea ref={ta} className="composer-input" rows={2} value={text} disabled={!root || !agent} aria-label={t('agent.placeholder')}
                placeholder={root ? t('agent.placeholder') : t('agent.needProject')}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }} />
              <div className="composer-bar">
                <div className="composer-tools">
                  <Dropdown variant="pill" icon="hubot" ariaLabel={t('agent.select')} disabled={running} value={agentId ?? ''}
                    options={agents.map((a) => ({ value: a.id, label: `${a.label}${a.kind === 'basic' ? ` (${t('agent.basic')})` : ''}` }))}
                    onChange={(v) => useAgent.getState().setAgent(v)} />
                  {agent?.kind === 'claude' && (
                    <Dropdown variant="pill" className={mode === 'bypassPermissions' ? 'danger' : ''} icon={MODE_ICON[mode]} ariaLabel={t('agent.mode')} disabled={running} value={mode}
                      options={MODES.map((m) => ({ value: m, label: t(`agent.mode.${m}`) }))}
                      onChange={(v) => useAgent.getState().setMode(v as AgentMode)} />
                  )}
                  {agentHeaderExtras.map((X, i) => <X key={i} />)}
                  <button className="icon-btn" title={t('agent.context')} aria-label={t('agent.context')} onClick={() => setCtx(true)}><Icon name="info" /></button>
                </div>
                <div className="composer-end">
                  <span className="agent-status">{status}</span>
                  {running
                    ? <button className="send-btn stop" title={t('agent.stop')} aria-label={t('agent.stop')} onClick={() => void useAgent.getState().stop()}><Icon name="debug-stop" /></button>
                    : <button className="send-btn" title={t('agent.send')} aria-label={t('agent.send')} disabled={!canSend || !text.trim()} onClick={submit}><Icon name="arrow-up" /></button>}
                </div>
              </div>
            </div>
          </div>}
        </>
      )}
      {ctx && <ContextDialog onClose={() => setCtx(false)} />}
      {hist && <HistoryDialog onClose={() => setHist(false)} />}
    </div>
  )
}
