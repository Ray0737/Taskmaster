import { useEffect } from 'react'
import type { AgentMode } from '@shared/types'
import { call } from '../ipc'
import { useApp } from '../stores/app'
import { useAgent } from '../stores/agent'
import { useT } from '../i18n'
import { Field } from '../components/Field'
import { settingsSections, setupRows } from './registry'
import { SetupRow } from './Welcome'

function AgentsSection() {
  const t = useT()
  const { agents, detected } = useAgent()
  const s = useApp((x) => x.settings!)
  const set = useApp((x) => x.set)
  useEffect(() => { if (!useAgent.getState().detected) void useAgent.getState().detect() }, [])
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, maxWidth: 560 }}>
        {detected && agents.length === 0 && <div className="dim">{t('settings.agents.none')}</div>}
        {agents.map((a) => (
          <div key={a.id} className="setup-row" style={{ alignItems: 'center' }}>
            <div className="setup-body" style={{ gap: 2 }}>
              <div><span className="setup-title">{a.label}</span> <span className="dim">{a.version}</span> {a.kind === 'basic' && <span className="tag">{t('agent.basic')}</span>}</div>
              <div className="dim small ellipsis" title={a.bin}>{a.bin}</div>
            </div>
          </div>
        ))}
        <div><button className="btn" onClick={() => void useAgent.getState().detect()}>{t('settings.agents.rescan')}</button></div>
      </div>
      <Field label={t('settings.agents.default')}>
        <select className="select" value={s.defaultAgent ?? ''} onChange={(e) => void set({ defaultAgent: e.target.value || null })}>
          <option value="">—</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </Field>
      <Field label={t('settings.agents.mode')} hint={s.defaultMode === 'bypassPermissions' ? t('agent.mode.fullWarning') : undefined}>
        <select className="select" value={s.defaultMode} onChange={(e) => void set({ defaultMode: e.target.value as AgentMode })}>
          {(['plan', 'acceptEdits', 'bypassPermissions'] as const).map((m) => <option key={m} value={m}>{t(`agent.mode.${m}`)}</option>)}
        </select>
      </Field>
    </>
  )
}

function AgentsRow() {
  const t = useT()
  const { agents, detected } = useAgent()
  useEffect(() => { void useAgent.getState().detect() }, [])
  return (
    <SetupRow ok={detected ? agents.length > 0 : null} title={t('welcome.agents')}>
      {!detected ? <span className="dim">{t('welcome.checking')}</span>
        : agents.length ? agents.map((a) => (
          <div key={a.id}>{t('welcome.agents.ok', { label: a.label, version: a.version })} {a.kind === 'basic' && <span className="tag">{t('agent.basic')}</span>}</div>
        )) : (
          <>
            <span className="danger">{t('welcome.agents.none')}</span>
            <span className="dim small">{t('welcome.agents.help')}</span>
          </>
        )}
      {detected && agents.length === 0 && (
        <div className="setup-actions">
          <button className="btn btn-primary" onClick={() => void call('shell.openExternal', 'https://docs.claude.com/en/docs/claude-code/overview')}>{t('agent.install')}</button>
          <button className="btn" onClick={() => void useAgent.getState().detect()}>{t('agent.rescan')}</button>
        </div>
      )}
    </SetupRow>
  )
}

settingsSections.push({ id: 'agents', title: 'settings.agents', Comp: AgentsSection })
setupRows.push(AgentsRow)
