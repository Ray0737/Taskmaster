import { useEffect } from 'react'
import { useApp } from './stores/app'
import { useSetup } from './stores/setup'
import { installKeybindings } from './commands'
import { applyTheme } from './theme/themes'
import { TitleBar } from './views/TitleBar'
import { ActivityBar } from './views/ActivityBar'
import { Workbench } from './views/Workbench'
import { StatusBar } from './views/StatusBar'
import { Welcome } from './views/Welcome'
import { ProjectDialogs } from './views/ProjectDialogs'
import { Palette } from './views/Palette'
import { Toasts, DialogHost, MenuHost } from './components/Overlays'

export default function App() {
  const s = useApp((x) => x.settings)
  const setupOpen = useSetup((x) => x.open)
  useEffect(() => { void useApp.getState().load(); installKeybindings() }, [])
  // A maximized or full-screen window fills the screen: the frame and rounded corners only show in a smaller window.
  useEffect(() => {
    const fit = () => document.documentElement.toggleAttribute('data-max', outerWidth >= screen.availWidth - 2 && outerHeight >= screen.availHeight - 2)
    fit()
    addEventListener('resize', fit)
    return () => removeEventListener('resize', fit)
  }, [])
  useEffect(() => {
    if (!s) return
    applyTheme(s.theme)
    document.documentElement.lang = s.lang
  }, [s?.theme, s?.lang])
  if (!s) return null
  const gated = !s.setupDone || setupOpen
  return (
    <div className="app">
      <TitleBar />
      {gated ? <div className="main"><Welcome /></div> : (
        <>
          <div className="main">
            <ActivityBar />
            <Workbench />
          </div>
          <StatusBar />
        </>
      )}
      <ProjectDialogs />
      <Palette />
      <Toasts />
      <DialogHost />
      <MenuHost />
    </div>
  )
}
