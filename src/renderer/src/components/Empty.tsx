import type { ReactNode } from 'react'

export function Empty({ text, children }: { text: string; children?: ReactNode }) {
  return <div className="empty"><div>{text}</div>{children}</div>
}
