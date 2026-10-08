import { useEffect, useState } from 'react'
import type { RecentProject } from '@shared/types'
import { call, errMsg } from '../ipc'
import { toast } from '../stores/ui'
import { runCommand } from '../commands'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import { openProject } from '../projects'
import { emptyEditorExtras } from './EditorArea'

function HomeBtn({ icon, title, desc, cmd }: { icon: string; title: string; desc: string; cmd: string }) {
  return (
    <button className="home-btn" onClick={() => runCommand(cmd)}>
      <Icon name={icon} />
      <span className="home-btn-text"><span>{title}</span><span className="dim small ellipsis">{desc}</span></span>
    </button>
  )
}

export function Home() {
  const t = useT()
  const [recent, setRecent] = useState<RecentProject[] | null>(null)
  useEffect(() => { call('recent.list').then(setRecent).catch(() => setRecent([])) }, [])
  return (
    <div className="home">
      <div className="home-col">
        <h2 className="home-h">{t('home.start')}</h2>
        <HomeBtn icon="new-folder" title={t('home.new')} desc={t('home.new.desc')} cmd="project.new" />
        <HomeBtn icon="folder-opened" title={t('home.open')} desc={t('home.open.desc')} cmd="project.openFolder" />
        <HomeBtn icon="repo-clone" title={t('home.clone')} desc={t('home.clone.desc')} cmd="project.clone" />
      </div>
      <div className="home-col">
        <h2 className="home-h">{t('home.recent')}</h2>
        {recent && recent.length === 0 && <div className="dim">{t('home.recent.empty')}</div>}
        {(recent ?? []).map((r) => (
          <div key={r.path} className="row recent-row" role="button" tabIndex={0} title={r.path}
            onClick={() => openProject(r.path).catch((e) => toast(errMsg(e), 'error'))}
            onKeyDown={(e) => { if (e.key === 'Enter') openProject(r.path).catch((err) => toast(errMsg(err), 'error')) }}>
            <Icon name="folder" />
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span className="ellipsis">{r.name}</span>
              <span className="dim small ellipsis">{r.path}</span>
            </span>
            <button className="icon-btn" title={t('home.recent.remove')} aria-label={t('home.recent.remove')}
              onClick={(e) => { e.stopPropagation(); void call('recent.remove', r.path).then(setRecent) }}>
              <Icon name="close" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

emptyEditorExtras.push(Home)
