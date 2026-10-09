import { create } from 'zustand'
import type { AgentInfo, AgentMode } from '@shared/types'
import type { PastSession } from '@shared/transcript'
import { call, on, errMsg } from '../ipc'
import { useApp } from './app'
import { reduceEvent, type Item, type NewItem } from './agentReduce'
import { agentHooks } from '../views/registry'

interface AgentState {
  agents: AgentInfo[]
  detected: boolean
  agentId: string | null
  mode: AgentMode
  items: Item[]
  runId: number | null
  startedAt: number | null
  sessionId: string | null
  usage: { inTokens: number; outTokens: number; costUsd: number | null } | null
  limits: Record<string, { utilization: number | null; status: string; resetsAt: number | null }> // latest plan usage window per kind
  model: string // --model id for Claude Code; '' = CLI default
  resolvedModel: string | null // model the CLI reported on its last init
  setModel(m: string): void
  taskId: string | null // set by Plan 4
  scope: string[] // task scope globs, set by Plan 4
  system: string // system prompt text, set by Plan 4 (empty = plain chat)
  lastPrompt: string
  detect(): Promise<void>
  setAgent(id: string): void
  setMode(m: AgentMode): void
  setContext(c: { taskId: string | null; system: string; scope: string[] }): void
  send(prompt: string): Promise<void>
  stop(): Promise<void>
  newChat(): Promise<void>
  retry(): Promise<void>
  history: PastSession[] | null // earlier Claude Code conversations of this project; null = not loaded yet
  loadHistory(): Promise<void>
  resume(id: string): Promise<void>
}

let seqItem = 0
let seqRun = 0
const nextId = (): number => ++seqItem
const keyOf = (s: { agentId: string | null; taskId: string | null }): string => `${s.agentId}:${s.taskId ?? 'chat'}`

export const useAgent = create<AgentState>((set, get) => {
  const push = (item: NewItem): void => set((s) => ({ items: [...s.items, { ...item, id: nextId() } as Item] }))
  return {
    agents: [], detected: false, agentId: null, mode: 'acceptEdits', items: [], runId: null, startedAt: null,
    sessionId: null, usage: null, limits: {}, model: '', resolvedModel: null, taskId: null, scope: [], system: '', lastPrompt: '',

    detect: async () => {
      const agents = await call('agent.detect')
      const st = useApp.getState().settings
      const cur = get().agentId
      const agentId = agents.find((a) => a.id === cur)?.id ?? agents.find((a) => a.id === st?.defaultAgent)?.id
        ?? agents.find((a) => a.kind === 'claude')?.id ?? agents[0]?.id ?? null
      set({ agents, detected: true, agentId, mode: get().items.length ? get().mode : (st?.defaultMode ?? 'acceptEdits') })
    },

    setAgent: (id) => set({ agentId: id, sessionId: null, items: [], usage: null }),
    setMode: (mode) => set({ mode }),
    setModel: (model) => set({ model }),

    setContext: (c) => {
      const changedTask = c.taskId !== get().taskId
      set({ taskId: c.taskId, system: c.system, scope: c.scope, ...(changedTask && !get().runId ? { items: [], sessionId: null, usage: null } : {}) })
    },

    send: async (prompt) => {
      const s = get()
      const root = useApp.getState().root
      const agent = s.agents.find((a) => a.id === s.agentId)
      if (!root || !agent || s.runId) return
      const runId = ++seqRun
      push({ kind: 'user', text: prompt })
      set({ runId, startedAt: Date.now(), lastPrompt: prompt })
      try {
        const sessionId = agent.kind === 'claude' ? (s.sessionId ?? (await call('agent.sessionGet', keyOf(s)))) : null
        await call('agent.run', { runId, agentId: agent.id, prompt, system: s.system, mode: s.mode, model: s.model, taskId: s.taskId, sessionId })
      } catch (e) {
        if (get().runId === runId) {
          set({ runId: null, startedAt: null })
          push({ kind: 'notice', level: 'error', raw: errMsg(e), action: 'retry' })
        }
      }
    },

    stop: async () => { const id = get().runId; if (id) await call('agent.stop', id) },

    newChat: async () => {
      await get().stop()
      const k = keyOf(get())
      set({ items: [], sessionId: null, usage: null })
      await call('agent.sessionSet', k, null)
    },

    retry: async () => {
      const p = get().lastPrompt
      if (p) await get().send(p)
    },

    history: null,

    loadHistory: async () => {
      if (!useApp.getState().root) { set({ history: [] }); return }
      try { set({ history: await call('agent.sessions') }) } catch { set({ history: [] }) }
    },

    // Shows an earlier conversation and continues it (the next message resumes that Claude Code session).
    resume: async (id) => {
      if (get().runId) return
      const root = useApp.getState().root ?? ''
      const entries = await call('agent.transcript', id)
      let items: Item[] = []
      for (const e of entries) {
        items = e.kind === 'user' ? [...items, { id: nextId(), kind: 'user', text: e.text }] : reduceEvent(items, e.ev, { root, scope: [] }, nextId)
      }
      set({ items, sessionId: id, usage: null })
      await call('agent.sessionSet', keyOf(get()), id)
    }
  }
})

on('agent.event', ({ runId, ev }) => {
  const s = useAgent.getState()
  if (runId !== s.runId) return
  if (ev.t === 'limit') {
    useAgent.setState((st) => ({ limits: { ...st.limits, [ev.kind]: { utilization: ev.utilization, status: ev.status, resetsAt: ev.resetsAt } } }))
    return
  }
  if (ev.t === 'init') {
    useAgent.setState({ sessionId: ev.sessionId, ...(ev.model ? { resolvedModel: ev.model } : {}) })
    void call('agent.sessionSet', keyOf(s), ev.sessionId)
    return
  }
  const root = useApp.getState().root ?? ''
  useAgent.setState((st) => ({ items: reduceEvent(st.items, ev, { root, scope: st.scope }, nextId) }))
  if (ev.t === 'result') {
    useAgent.setState({ usage: { inTokens: ev.inTokens, outTokens: ev.outTokens, costUsd: ev.costUsd }, ...(ev.sessionId ? { sessionId: ev.sessionId } : {}) })
    for (const h of agentHooks.onResult) h({ taskId: s.taskId, ok: ev.ok, text: ev.text })
  }
})

on('agent.exit', ({ runId }) => {
  if (runId === useAgent.getState().runId) {
    useAgent.setState({ runId: null, startedAt: null })
    void useAgent.getState().loadHistory() // the finished turn belongs in the list
  }
})
