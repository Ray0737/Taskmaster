import { create } from 'zustand'
import { call, on } from '../ipc'
import { showPanel } from '../layout'

export interface TermInfo { id: number; title: string; exited: boolean }

interface TermState { list: TermInfo[]; active: number | null; available: boolean | null }
export const useTerm = create<TermState>(() => ({ list: [], active: null, available: null }))

const writers = new Map<number, (d: string) => void>()
const buffers = new Map<number, string[]>()

on('pty.data', ({ id, data }) => {
  const w = writers.get(id)
  if (w) w(data)
  else buffers.set(id, [...(buffers.get(id) ?? []), data])
})
on('pty.exit', ({ id }) => {
  writers.get(id)?.('\r\n[process exited]\r\n')
  useTerm.setState((s) => ({ list: s.list.map((t) => (t.id === id ? { ...t, exited: true } : t)) }))
})

export function attachWriter(id: number, w: (d: string) => void): () => void {
  writers.set(id, w)
  for (const d of buffers.get(id) ?? []) w(d)
  buffers.delete(id)
  return () => { writers.delete(id) }
}

let n = 0
export async function newTerminal(cmd?: string): Promise<void> {
  showPanel('panel')
  if (useTerm.getState().available === null) useTerm.setState({ available: await call('pty.available') })
  if (!useTerm.getState().available) return
  const id = await call('pty.create', { cols: 80, rows: 24, cmd })
  const title = `${++n}: ${cmd ?? (navigator.userAgent.includes('Windows') ? 'powershell' : 'shell')}`
  useTerm.setState((s) => ({ list: [...s.list, { id, title, exited: false }], active: id }))
}

export async function killTerminal(id: number): Promise<void> {
  await call('pty.kill', id)
  useTerm.setState((s) => {
    const list = s.list.filter((t) => t.id !== id)
    return { list, active: s.active === id ? (list[list.length - 1]?.id ?? null) : s.active }
  })
}
