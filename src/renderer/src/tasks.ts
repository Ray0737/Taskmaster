import type { TaskStatus } from '@shared/team'
import { call, errMsg } from './ipc'
import { useGit } from './stores/git'
import { useTeam } from './stores/team'
import { choiceDialog, toast } from './stores/ui'
import { showPanel } from './layout'
import { tr } from './i18n'

// Spec §8: (1) a code branch tm/<login>/<id> (2) status doing + assignee (3) presence + agent bound to the task.
export async function startTask(id: string): Promise<void> {
  const { data, me } = useTeam.getState()
  const task = data?.tasks.find((t) => t.id === id)
  if (!task || !me) return
  const branch = task.branch ?? `tm/${me}/${task.id}`
  try {
    await useGit.getState().refresh()
    const st = useGit.getState().status
    if (st && st.branch !== branch && st.files.length) {
      const choice = await choiceDialog({
        title: tr('task.dirty.title'), text: tr('task.dirty.text'),
        options: [{ label: tr('task.dirty.stash'), value: 'stash' }, { label: tr('task.dirty.commit'), value: 'commit' }]
      })
      if (!choice) return // cancelled: nothing has changed
      if (choice === 'stash') await call('git.stashAll', `taskmaster: before ${task.id}`)
      else await call('git.commitAll', `WIP before starting: ${task.title}`)
    }
    if (st?.branch !== branch) await call('git.startBranch', branch)
    await useGit.getState().refresh()
    await useTeam.getState().saveTask({ ...task, status: 'doing', assignee: task.assignee ?? me, branch })
    await call('team.setPresence', { taskId: task.id, branch, status: 'working' })
    useTeam.getState().setActiveTask(task.id)
    showPanel('agent')
    toast(tr('task.started', { title: task.title, branch }))
  } catch (e) {
    toast(errMsg(e), 'error') // e.g. git refuses to switch: the user's changes are untouched
  }
}

export async function setTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const st = useTeam.getState()
  const task = st.data?.tasks.find((t) => t.id === id)
  if (!task) return
  try {
    await st.saveTask({ ...task, status })
    if (status !== 'doing' && st.activeTaskId === id) await call('team.setPresence', { taskId: null, branch: null, status: 'idle' })
  } catch (e) { toast(errMsg(e), 'error') }
}
