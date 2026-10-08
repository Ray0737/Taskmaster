export interface PromptContext {
  role?: { label: string; prompt: string }
  task?: { title: string; brief: string; files: string[] }
  others: { login: string; role: string; taskTitle: string }[] // teammates with a task in `doing`
  notes: { taskTitle: string; login: string; text: string; at: string }[] // any order; newest are used
}

export const PROMPT_CAP = 6000
const NOTE_MAX = 400
const NOTES_SHOWN = 5

const trim = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1) + '…' : s)

function render(c: PromptContext, notes: PromptContext['notes'], brief: string): string {
  const L: string[] = ['You are working in a team project managed by Taskmaster.']
  if (c.role) L.push(`Your role: ${c.role.label} — ${c.role.prompt}`)
  if (c.task) {
    L.push(`Your task: ${c.task.title}`, brief)
    L.push(`Stay inside these files when possible: ${c.task.files.length ? c.task.files.join(', ') : 'any'}`)
  }
  if (c.others.length) L.push('Team right now:', ...c.others.map((o) => `- @${o.login} (${o.role}) doing "${o.taskTitle}"`))
  if (notes.length) {
    L.push(`Recent notes (newest first, max ${NOTES_SHOWN}, each trimmed to ${NOTE_MAX} chars):`,
      ...notes.map((n) => `- [${n.taskTitle}] @${n.login}: ${trim(n.text.replace(/\s+/g, ' ').trim(), NOTE_MAX)}`))
  }
  if (c.task) L.push('When you finish, end your final message with:', '<tm-note>2–5 lines: what you changed, what others should know</tm-note>')
  return L.join('\n')
}

// Pure. Returns '' when there is nothing to tell the agent (plain chat).
export function buildSystemPrompt(c: PromptContext): string {
  if (!c.role && !c.task && !c.others.length && !c.notes.length) return ''
  const notes = [...c.notes].sort((a, b) => b.at.localeCompare(a.at)).slice(0, NOTES_SHOWN)
  let brief = c.task?.brief ?? ''
  let out = render(c, notes, brief)
  while (out.length > PROMPT_CAP && notes.length) { notes.pop(); out = render(c, notes, brief) } // oldest note first
  if (out.length > PROMPT_CAP && c.task) {
    brief = trim(brief, Math.max(0, brief.length - (out.length - PROMPT_CAP) - 1))
    out = render(c, notes, brief)
  }
  return out
}

// Last non-empty <tm-note> in the agent's final text.
export function extractNote(text: string): string | null {
  const all = [...text.matchAll(/<tm-note>([\s\S]*?)<\/tm-note>/g)].map((m) => m[1].trim()).filter(Boolean)
  return all.length ? all[all.length - 1] : null
}
