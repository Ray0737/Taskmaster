import type { Api, Events } from '@shared/api'

declare global {
  interface Window {
    tm: {
      invoke(ch: string, ...args: unknown[]): Promise<unknown>
      on(ch: string, cb: (p: unknown) => void): () => void
    }
  }
}

export function call<K extends keyof Api>(k: K, ...args: Parameters<Api[K]>): ReturnType<Api[K]> {
  return window.tm.invoke(k, ...args) as ReturnType<Api[K]>
}

export function on<K extends keyof Events>(k: K, cb: (p: Events[K]) => void): () => void {
  return window.tm.on(k, cb as (p: unknown) => void)
}

// Strips Electron's "Error invoking remote method 'x': Error: " prefix.
export function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  return m.replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, '')
}
