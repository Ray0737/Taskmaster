import { useEffect } from 'react'
import { useApp } from './stores/app'
import { installKeybindings } from './commands'
import { applyTheme } from './theme/themes'
import { TitleBar } from './views/TitleBar'
import { ActivityBar } from './views/ActivityBar'
import { Workbench } from './views/Workbench'
import { StatusBar } from './views/StatusBar'
import { Toasts, DialogHost, MenuHost } from './components/Overlays'
import { Palette } from './views/Palette'

export default function App() {
  const s = useApp((x) => x.settings)
  useEffect(() => { void useApp.getState().load(); installKeybindings() }, [])
  useEffect(() => {
    if (!s) return
    applyTheme(s.theme)
    document.documentElement.lang = s.lang
  }, [s?.theme, s?.lang])
  if (!s) return null
  return (
    <div className="app">
      <TitleBar />
      <div className="main">
        <ActivityBar />
        <Workbench />
      </div>
      <StatusBar />
      <Palette />
      <Toasts />
      <DialogHost />
      <MenuHost />
    </div>
  )
}
