import { useState } from 'react'
import { useApp } from '../stores/app'
import { useEditor } from '../stores/editor'
import { useT } from '../i18n'
import { THEMES, THEME_IDS } from '../theme/themes'
import { registerCommand } from '../commands'
import { Field } from '../components/Field'
import { Dropdown } from '../components/Dropdown'
import { Group } from '../components/Group'
import { Icon } from '../components/Icon'
import { settingsSections } from './registry'
import { tabRenderers } from './EditorArea'

const SECTION_ICON: Record<string, string> = { general: 'settings-gear', editor: 'edit', account: 'account', agents: 'hubot', sync: 'sync' }

function General() {
  const t = useT()
  const s = useApp((x) => x.settings!)
  const set = useApp((x) => x.set)
  return (
    <>
      <Group icon="globe" title={t('settings.language')} desc={t('settings.language.desc')}>
        <div className="tabs-inline" role="radiogroup" aria-label={t('settings.language')}>
          {([['en', 'English'], ['th', 'ไทย']] as const).map(([v, label]) => (
            <button key={v} role="radio" aria-checked={s.lang === v} className={`btn${s.lang === v ? ' on' : ''}`} onClick={() => void set({ lang: v })}>{label}</button>
          ))}
        </div>
      </Group>
      <Group icon="color-mode" title={t('settings.theme')} desc={t('settings.theme.desc')}>
        <div className="tabs-inline" role="radiogroup" aria-label={t('settings.theme')} style={{ flexWrap: 'wrap' }}>
          {THEME_IDS.map((id) => (
            <button key={id} role="radio" aria-checked={s.theme === id} className={`btn${s.theme === id ? ' on' : ''}`} onClick={() => void set({ theme: id })}>{THEMES[id].label}</button>
          ))}
        </div>
        {(() => {
          const u = THEMES[s.theme].ui
          return (
            <div className="theme-preview" style={{ background: u['bg-0'] }} aria-hidden="true">
              <div className="tp-side" style={{ background: u['bg-1'] }}>
                <span style={{ background: u.selected }} /><span style={{ background: u['fg-faint'] }} /><span style={{ background: u['fg-faint'] }} /><span style={{ background: u['fg-faint'] }} />
              </div>
              <div className="tp-main">
                <div className="tp-tabs" style={{ background: u['bg-bar'] }}>
                  <span className="tp-tab" style={{ background: u['bg-0'], boxShadow: `inset 0 -2px 0 ${u.accent}` }} />
                  <span className="tp-tab" style={{ background: u['bg-1'] }} />
                </div>
                <div className="tp-code">
                  <span style={{ background: u.accent, width: '38%' }} /><span style={{ background: u.fg, width: '66%' }} /><span style={{ background: u['fg-dim'], width: '52%' }} />
                  <span style={{ background: u.danger, width: '24%' }} /><span style={{ background: u.fg, width: '58%' }} />
                </div>
              </div>
              <div className="tp-status" style={{ background: u.accent }} />
            </div>
          )
        })()}
      </Group>
    </>
  )
}

function EditorSection() {
  const t = useT()
  const s = useApp((x) => x.settings!)
  const set = useApp((x) => x.set)
  return (
    <>
      <Group icon="symbol-text" title={t('settings.group.text')} desc={t('settings.group.text.desc')}>
        <Field label={t('settings.fontSize')} hint="10–24">
          <input className="input" type="number" min={10} max={24} value={s.fontSize}
            onChange={(e) => { const n = Number(e.target.value); if (n >= 10 && n <= 24) void set({ fontSize: n }) }} />
        </Field>
        <label className="field-inline">
          <input type="checkbox" className="check" checked={s.wordWrap} onChange={(e) => void set({ wordWrap: e.target.checked })} />
          {t('settings.wordWrap')}
        </label>
      </Group>
      <Group icon="save" title={t('settings.autoSave')} desc={t('settings.autoSave.desc')}>
        <Field label={t('settings.autoSave')}>
          <Dropdown ariaLabel={t('settings.autoSave')} value={s.autoSave}
            options={[{ value: 'off', label: t('settings.autoSave.off') }, { value: 'delay', label: t('settings.autoSave.delay') }]}
            onChange={(v) => void set({ autoSave: v as 'off' | 'delay' })} />
        </Field>
      </Group>
    </>
  )
}

settingsSections.push({ id: 'general', title: 'settings.general', Comp: General }, { id: 'editor', title: 'settings.editor', Comp: EditorSection })

export function SettingsTab() {
  const t = useT()
  const [sec, setSec] = useState(settingsSections[0].id)
  const S = settingsSections.find((x) => x.id === sec) ?? settingsSections[0]
  return (
    <div className="split-view">
      <nav className="split-nav scroll" aria-label={t('tab.settings')}>
        <div className="nav-label">{t('tab.settings')}</div>
        {settingsSections.map((x) => (
          <button key={x.id} className={`row${x.id === sec ? ' sel' : ''}`} onClick={() => setSec(x.id)}>
            <Icon name={SECTION_ICON[x.id] ?? 'circle-small'} />
            <span className="ellipsis">{t(x.title)}</span>
          </button>
        ))}
      </nav>
      <div className="split-body scroll">
        <div className="settings-page">
          <div className="page-head"><Icon name={SECTION_ICON[S.id] ?? 'circle-small'} /><h1>{t(S.title)}</h1></div>
          <S.Comp />
        </div>
      </div>
    </div>
  )
}

tabRenderers.settings = SettingsTab
registerCommand({ id: 'settings.open', title: 'cmd.settings', keys: 'Ctrl+,', run: () => useEditor.getState().open({ kind: 'settings', title: 'tab.settings' }) })
