import type { ComponentType } from 'react'
import type { SidebarView } from '../stores/app'

export interface SidebarViewDef {
  id: SidebarView
  title: string // i18n key
  icon: string // codicon name
  Comp: ComponentType
  Actions?: ComponentType
  Badge?: ComponentType
}
export interface SettingsSectionDef { id: string; title: string; Comp: ComponentType }

// Later tasks/plans push into these. Order of push = display order.
export const sidebarViews: SidebarViewDef[] = []
export const activityBottom: ComponentType[] = []
export const statusLeft: ComponentType[] = []
export const statusRight: ComponentType[] = []
export const settingsSections: SettingsSectionDef[] = []

// Rows shown on the Welcome screen below the GitHub row (Plan 3 adds Agents).
export const setupRows: ComponentType[] = []

// Extra controls in the Agent panel header (Plan 4 adds the Task select).
export const agentHeaderExtras: ComponentType[] = []

export interface AgentResultInfo { taskId: string | null; ok: boolean; text: string }
// Called once per finished agent turn (Plan 4 saves the <tm-note> and moves the task to review).
export const agentHooks: { onResult: ((r: AgentResultInfo) => void)[] } = { onResult: [] }

// Extra rows above the agent input (the "save a note" box).
export const agentFooterExtras: ComponentType[] = []
