import { useEffect } from 'react'
import type { AgentMode } from '@shared/types'
import { call } from '../ipc'
import { useApp } from '../stores/app'
import { useAgent } from '../stores/agent'
import { useT } from '../i18n'
import { Field } from '../components/Field'
import { Dropdown } from '../components/Dropdown'
import { Group } from '../components/Group'
import { Icon } from '../components/Icon'
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
      <Group icon="terminal" title={t('settings.group.detected')} desc={t('settings.group.detected.desc')}>
        {detected && agents.length === 0 && <div className="dim">{t('settings.agents.none')}</div>}
        {agents.map((a) => (
          <div key={a.id} className="setup-row" style={{ alignItems: 'center' }}>
            <div className="setup-body" style={{ gap: 2 }}>
              <div><span className="setup-title">{a.label}</span> <span className="dim">{a.version}</span> {a.kind === 'basic' && <span className="tag">{t('agent.basic')}</span>}</div>
              <div className="dim small ellipsis" title={a.bin}>{a.bin}</div>
            </div>
          </div>
        ))}
        <div><button className="btn" onClick={() => void useAgent.getState().detect()}><Icon name="refresh" />{t('settings.agents.rescan')}</button></div>
      </Group>
      <Group icon="settings-gear" title={t('settings.group.defaults')} desc={t('settings.group.defaults.desc')}>
      <Field label={t('settings.agents.default')}>
        <Dropdown ariaLabel={t('settings.agents.default')} value={s.defaultAgent ?? ''}
          options={[{ value: '', label: '—' }, ...agents.map((a) => ({ value: a.id, label: a.label }))]}
          onChange={(v) => void set({ defaultAgent: v || null })} />
      </Field>
      <Field label={t('settings.agents.mode')} hint={s.defaultMode === 'bypassPermissions' ? t('agent.mode.fullWarning') : undefined}>
        <Dropdown ariaLabel={t('settings.agents.mode')} value={s.defaultMode}
          options={(['plan', 'acceptEdits', 'bypassPermissions'] as const).map((m) => ({ value: m, label: t(`agent.mode.${m}`) }))}
          onChange={(v) => void set({ defaultMode: v as AgentMode })} />
      </Field>
      </Group>
      <Group icon="extensions" title={t('settings.group.skills')} desc={t('settings.group.skills.desc')}>
        <label className="field-inline">
          <input type="checkbox" className="check" checked={s.teamSkills} onChange={(e) => void set({ teamSkills: e.target.checked })} />
          {t('settings.teamSkills')}
        </label>
      </Group>
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
