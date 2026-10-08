import { Component, type ReactNode } from 'react'
import { tr } from '../i18n'

// One crashed region never blanks the whole app (spec §14).
export class Boundary extends Component<{ name: string; children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  componentDidCatch(err: Error) { console.error(err) }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="empty">
        <div className="danger">{tr('error.view', { name: this.props.name })}</div>
        <div className="dim small mono">{this.state.err.message}</div>
        <button className="btn" onClick={() => this.setState({ err: null })}>{tr('error.reload')}</button>
      </div>
    )
  }
}
