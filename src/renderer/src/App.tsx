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
import { Palette } from './views/Palette'
import { Toasts, DialogHost, MenuHost } from './components/Overlays'

export default function App() {
  const s = useApp((x) => x.settings)
  const setupOpen = useSetup((x) => x.open)
  useEffect(() => { void useApp.getState().load(); installKeybindings() }, [])
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
      <Palette />
      <Toasts />
      <DialogHost />
      <MenuHost />
    </div>
  )
}
