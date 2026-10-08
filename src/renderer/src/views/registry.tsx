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
