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
      <Group icon="globe" title={t('settings.language')}>
        <div className="group-body">
          <Dropdown ariaLabel={t('settings.language')} value={s.lang} options={[{ value: 'en', label: 'English' }, { value: 'th', label: 'ไทย' }]}
            onChange={(v) => void set({ lang: v as 'en' | 'th' })} />
        </div>
      </Group>
      <Group icon="color-mode" title={t('settings.theme')}>
        <div className="swatches" role="radiogroup" aria-label={t('settings.theme')}>
          {THEME_IDS.map((id) => {
            const u = THEMES[id].ui
            return (
              <button key={id} role="radio" aria-checked={s.theme === id} className={`swatch${s.theme === id ? ' sel' : ''}`} onClick={() => void set({ theme: id })}>
                <span className="ellipsis">{THEMES[id].label}</span>
                <span className="swatch-colors">
                  {[u['bg-0'], u['bg-1'], u.fg, u.accent, u.danger].map((c, i) => <span key={i} style={{ background: c }} />)}
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
      <Group icon="edit" title={t('settings.editor')}>
        <Field label={t('settings.fontSize')} hint="10–24">
          <input className="input" type="number" min={10} max={24} value={s.fontSize}
            onChange={(e) => { const n = Number(e.target.value); if (n >= 10 && n <= 24) void set({ fontSize: n }) }} />
        </Field>
        <label className="field-inline group-row">
          <input type="checkbox" className="check" checked={s.wordWrap} onChange={(e) => void set({ wordWrap: e.target.checked })} />
          {t('settings.wordWrap')}
        </label>
      </Group>
      <Group icon="save" title={t('settings.autoSave')}>
        <div className="group-body">
          <Dropdown ariaLabel={t('settings.autoSave')} value={s.autoSave}
            options={[{ value: 'off', label: t('settings.autoSave.off') }, { value: 'delay', label: t('settings.autoSave.delay') }]}
            onChange={(v) => void set({ autoSave: v as 'off' | 'delay' })} />
        </div>
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
        {settingsSections.map((x) => (
          <button key={x.id} className={`row${x.id === sec ? ' sel' : ''}`} onClick={() => setSec(x.id)}>
            <Icon name={SECTION_ICON[x.id] ?? 'circle-small'} />
            <span className="ellipsis">{t(x.title)}</span>
          </button>
        ))}
      </nav>
      <div className="split-body scroll">
        <div className="doc"><h1>{t(S.title)}</h1><S.Comp /></div>
      </div>
    </div>
  )
}

tabRenderers.settings = SettingsTab
registerCommand({ id: 'settings.open', title: 'cmd.settings', keys: 'Ctrl+,', run: () => useEditor.getState().open({ kind: 'settings', title: 'tab.settings' }) })
