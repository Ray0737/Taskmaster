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
        <div className="swatches" role="radiogroup" aria-label={t('settings.theme')}>
          {THEME_IDS.map((id) => {
            const u = THEMES[id].ui
            const sel = s.theme === id
            return (
              <button key={id} role="radio" aria-checked={sel} className={`swatch${sel ? ' sel' : ''}`} onClick={() => void set({ theme: id })}>
                <span className="swatch-thumb" style={{ background: u['bg-0'] }} aria-hidden="true">
                  <span className="sw-side" style={{ background: u['bg-1'] }} />
                  <span className="sw-main">
                    <span className="sw-bar" style={{ background: u.accent }} />
                    <span className="sw-line" style={{ background: u.fg }} />
                    <span className="sw-line" style={{ background: u.fg, width: '50%' }} />
                  </span>
                </span>
                <span className="swatch-label">
                  {sel && <Icon name="check" />}
                  <span className="ellipsis">{THEMES[id].label}</span>
                </span>
              </button>
            )
          })}
        </div>
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
