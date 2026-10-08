import { create } from 'zustand'
import type { GitIdentity } from '@shared/types'
import { call, errMsg } from '../ipc'
import { toast } from './ui'
import { tr } from '../i18n'
import { useGit } from './git'

interface SetupState {
  open: boolean // show Welcome even after first run (Help -> Setup check)
  checking: boolean
  git: string | null | undefined // undefined = not checked yet, null = missing
  identity: GitIdentity | null
  connecting: boolean
  check(): Promise<void>
  saveIdentity(i: GitIdentity): Promise<void>
  connect(): Promise<void>
}

export const useSetup = create<SetupState>((set) => ({
  open: false, checking: false, git: undefined, identity: null, connecting: false,

  check: async () => {
    set({ checking: true })
    const [git, identity] = await Promise.all([call('git.version'), call('git.identity')])
    set({ git, identity })
    if (git) await useGit.getState().loadAccount()
    set({ checking: false })
  },

  saveIdentity: async (i) => {
    try {
      await call('git.setIdentity', i)
      set({ identity: await call('git.identity') })
    } catch (e) {
      toast(errMsg(e) || tr('welcome.identity.invalid'), 'error')
    }
  },

  connect: async () => {
    set({ connecting: true })
    const a = await useGit.getState().connect()
    set({ connecting: false })
    if (!a) toast(tr('welcome.github.failed'), 'error')
  }
}))
