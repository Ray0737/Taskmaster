import type { ReactNode } from 'react'
import { Icon } from './Icon'

// A titled card with a divider line, to show where one settings area ends and the next begins.
export function Group({ title, icon, children }: { title: string; icon?: string; children: ReactNode }) {
  return (
    <section className="group">
      <h3 className="group-title">{icon && <Icon name={icon} />}{title}</h3>
      {children}
    </section>
  )
}
