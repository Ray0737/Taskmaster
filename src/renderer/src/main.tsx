import { createRoot } from 'react-dom/client'
import '@vscode/codicons/dist/codicon.css'
import './theme/base.css'
import './monaco'
import './coreCommands'
import './views/Explorer'
import './views/SettingsTab'
import './views/ManualTab'
import App from './App'

createRoot(document.getElementById('root')!).render(<App />)
