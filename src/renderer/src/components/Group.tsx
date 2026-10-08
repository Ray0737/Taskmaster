import type { ReactNode } from 'react'
import { Icon } from './Icon'

// A settings card: title (with icon) and an optional one-line description, then the controls.
export function Group({ title, icon, desc, children }: { title: string; icon?: string; desc?: string; children: ReactNode }) {
  return (
    <section className="group">
      <div className="group-head">
        <h3 className="group-title">{icon && <Icon name={icon} />}{title}</h3>
        {desc && <div className="group-desc">{desc}</div>}
      </div>
      <div className="group-body">{children}</div>
    </section>
  )
}
