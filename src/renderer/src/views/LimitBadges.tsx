import { useAgent } from '../stores/agent'
import { useT } from '../i18n'
import { call } from '../ipc'

// ponytail: the CLI gives no reliable percent, so one button opens the real numbers on claude.ai. Reading the OAuth token to fetch them ourselves was rejected as unsafe.
const USAGE_URL = 'https://claude.ai/settings/usage'

// "View usage", prefixed with a window's percent (5hr 42%) only when the CLI reported one. Hover lists reset times.
export function LimitBadges() {
  const t = useT()
  const limits = useAgent((s) => s.limits)
  const nameOf = (kind: string) => (kind === 'five_hour' ? '5hr' : kind === 'seven_day' ? '7d' : kind)
  const known = Object.entries(limits)
    .filter(([, l]) => l.status === 'rejected' || l.utilization != null)
    .map(([kind, l]) => t('agent.limit', { name: nameOf(kind), use: l.status === 'rejected' ? t('agent.limit.hit') : `${Math.round((l.utilization ?? 0) * 100)}%` }))
  const tip = Object.entries(limits).map(([kind, l]) => {
    const reset = l.resetsAt ? new Date(l.resetsAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
    return t('agent.limit.tip', { name: nameOf(kind), reset: reset ? t('agent.limit.reset', { time: reset }) : '' })
  })
  return (
    <button className="tb-limit" title={[...tip, t('agent.limit.open')].join('\n')} onClick={() => void call('shell.openExternal', USAGE_URL)}>
      {[...known, t('agent.limit.view')].join(' · ')}
    </button>
  )
}
