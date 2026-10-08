import { createRoot } from 'react-dom/client'
import '@vscode/codicons/dist/codicon.css'
import './theme/base.css'
import './monaco'
import './coreCommands'
import './projects'
import './views/Explorer'
import './views/SettingsTab'
import './views/ManualTab'
import './views/Home'
import App from './App'

createRoot(document.getElementById('root')!).render(<App />)
