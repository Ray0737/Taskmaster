import { useEffect, useState } from 'react'

// Re-renders every `ms` so "online / offline" labels age without any event.
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(i) }, [ms])
  return now
}
