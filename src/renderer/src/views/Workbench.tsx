import { useEffect, useRef } from 'react'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import type { Layout } from '@shared/types'
import { useApp, type PanelKey } from '../stores/app'
import { panels } from '../layout'
import { mergeDebounce } from '../util'
import { Boundary } from '../components/Boundary'
import { Sidebar } from './Sidebar'
import { EditorArea } from './EditorArea'
import { BottomPanel } from './BottomPanel'
import { AgentPanel } from './AgentPanel'

const saveLayout = mergeDebounce<Partial<Layout>>((p) => void useApp.getState().set({ layout: p }), 400)
const visKey: Record<PanelKey, keyof Layout> = { side: 'sidebarVisible', agent: 'agentVisible', panel: 'panelVisible' }
const vis = (k: PanelKey, v: boolean) => () => { useApp.getState().setOpen(k, v); saveLayout({ [visKey[k]]: v }) }

export function Workbench() {
  // Read once: panel sizes are owned by the library after mount.
  const init = useRef(useApp.getState().settings!.layout).current
  useEffect(() => {
    if (!init.sidebarVisible) panels.side?.collapse()
    if (!init.agentVisible) panels.agent?.collapse()
    if (!init.panelVisible) panels.panel?.collapse()
  }, [init])

  return (
    <PanelGroup direction="horizontal" className="workbench"
      onLayout={(s) => saveLayout({ ...(s[0] > 0 ? { sidebar: s[0] } : {}), ...(s[2] > 0 ? { agent: s[2] } : {}) })}>
      <Panel id="side" order={1} ref={(r) => { panels.side = r }} defaultSize={init.sidebar} minSize={12} maxSize={40}
        collapsible collapsedSize={0} onCollapse={vis('side', false)} onExpand={vis('side', true)}>
        <Boundary name="Sidebar"><Sidebar /></Boundary>
      </Panel>
      <PanelResizeHandle className="sash sash-v" />
      <Panel id="center" order={2} minSize={25}>
        <PanelGroup direction="vertical" onLayout={(s) => { if (s[1] > 0) saveLayout({ panel: s[1] }) }}>
          <Panel id="editor" order={1} minSize={20}>
            <Boundary name="Editor"><EditorArea /></Boundary>
          </Panel>
          <PanelResizeHandle className="sash sash-h" />
          <Panel id="panel" order={2} ref={(r) => { panels.panel = r }} defaultSize={init.panel} minSize={10}
            collapsible collapsedSize={0} onCollapse={vis('panel', false)} onExpand={vis('panel', true)}>
            <Boundary name="Panel"><BottomPanel /></Boundary>
          </Panel>
        </PanelGroup>
      </Panel>
      <PanelResizeHandle className="sash sash-v" />
      <Panel id="agent" order={3} ref={(r) => { panels.agent = r }} defaultSize={init.agent} minSize={20} maxSize={50}
        collapsible collapsedSize={0} onCollapse={vis('agent', false)} onExpand={vis('agent', true)}>
        <Boundary name="Agent"><AgentPanel /></Boundary>
      </Panel>
    </PanelGroup>
  )
}
