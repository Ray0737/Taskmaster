# Architecture

## Processes

```
main process (Node)                          renderer (React)
  services/                                    stores/   zustand state
    settings  userData/settings.json           views/    screens, registered into registries
    fs        guarded file access + watcher    components/  Icon, Boundary, Overlays, Field, Empty
    pty       terminal sessions                theme/    base.css + themes.ts (4 themes)
    manual    bundled manual chapters          i18n/     en*.json, th*.json (merged by language)
    git       git CLI wrapper (execFile)       commands.ts  command registry + keybindings
    auth      GitHub token (gh / GCM)          projects.ts, tasks.ts, pr.ts  user flows
    recent    recent projects
    project   create / close project
    agents    detect, spawn, stream agent CLIs
    teamfs    read/write .taskmaster files
    teamsync  git worktree sync engine
    team      sync scheduler, presence, IPC
         ^                                              |
         |  ipc.ts handle()/emit()                      |  window.tm.invoke / on  (preload, contextBridge)
         +----------------------------------------------+
```

`src/shared/` holds code that both sides import and that is unit tested: IPC types (`api.ts`), data types and parsers (`team.ts`), the agent stream parser (`agent.ts`), the prompt builder (`prompt.ts`), scope matching (`scope.ts`), path helpers, fuzzy matching, key mapping, GitHub URL helpers.

The window runs with `contextIsolation`, `sandbox`, no Node integration and a strict CSP. The preload exposes only `invoke` and `on`. Every handler that receives a path checks it against the open project root (`inside()` in `services/fs.ts`); the few exceptions are listed in the plan constraints (folders just picked in a dialog).

## IPC

`src/shared/api.ts` is the contract: `Api` maps a channel name to a function, `Events` maps an event name to its payload. The renderer calls `call('git.status')`; the main process registers `handle('git.status', fn)`. Both are fully typed.

| Area | Channels |
|---|---|
| App | `settings.get/set`, `win.setOverlay/role`, `shell.openExternal`, `app.quit/openLogs`, `dialog.openFolder`, `manual.list/read` |
| Project and files | `project.open/create/close`, `recent.list/add/remove`, `fs.list/read/write/create/rename/delete/reveal/listAll` |
| Terminal | `pty.available/create/write/resize/kill` |
| Git | `git.version/identity/setIdentity/isRepo/init/status/stage/unstage/discard/commit/branches/switch/sync/show/remoteUrl/clone/cloneCancel/startBranch/stashAll/commitAll` |
| GitHub | `auth.status/connect/repos/collaborators/invite` |
| Agents | `agent.detect/run/stop/sessionGet/sessionSet` |
| Team | `team.attach/enable/read/saveTeam/saveTask/deleteTask/images/imageData/addImage/removeImage/skills/saveSkill/deleteSkill/scanSkills/importSkills/addNote/setPresence/syncNow/resetToRemote/detach` |
| Events | `fs.changed`, `pty.data`, `pty.exit`, `git.progress`, `agent.event`, `agent.exit`, `team.changed`, `team.sync` |

## Registries (how views plug in)

`views/registry.tsx` exports arrays that feature modules push into when they are imported from `main.tsx`:

| Registry | Used for |
|---|---|
| `sidebarViews` | an activity-bar icon + sidebar view (Explorer, Source Control, Tasks, Team) |
| `activityBottom`, `statusLeft`, `statusRight` | extra activity-bar buttons and status-bar items |
| `settingsSections` | sections of the Settings tab |
| `setupRows` | rows on the Welcome screen |
| `agentHeaderExtras`, `agentFooterExtras`, `agentHooks.onResult` | the agent panel (task select, note box, note capture) |
| `editorBanners` | strips above the editor |
| `tabRenderers` (in `EditorArea.tsx`) | content of tab kinds (`settings`, `manual`, `task`, `diff`, `mdpreview`) |
| `emptyEditorExtras` | what the editor shows when no folder is open (Home) |

The import order in `main.tsx` is the display order. Commands are registered with `registerCommand`; a later registration with the same id replaces the earlier one.

## Team data on git

Branch `taskmaster/context`, checked out as a worktree at `<userData>/worktrees/<sha1(project path)>`:

```
.taskmaster/
  team.json                          { lead, members:[{login, role, joinedAt}], roles:[{id, label, prompt}] }
  tasks/<id>.json                    Task  (id = t-xxxxxxxx)
  notes/<task id>/<time>-<login>.md  one file per note
  attachments/<task id>/<ms>.<ext>   screenshots pasted into a task (png/jpg/webp/gif, 4 MB, 10 per task); the agent host passes the folder with --add-dir and lists the paths in the system prompt
  presence/<login>.json              { login, taskId, branch, status, running, at }  (running: the agent host reports a run via setAgentRunning)
  plugin/.claude-plugin/plugin.json  Claude Code plugin "team" (team skills)
  plugin/skills/<name>/SKILL.md      one team skill each; loaded with --plugin-dir only if settings.teamSkills is on
  plugin/skills/<name>/.source       only for skills imported from GitHub (services/skillimport.ts): the folder keeps all its files and the editor is read-only
```

Ids and logins from files are validated before use (they become file and branch names). `teamsync.ts` commits after local changes, pushes (one pull-rebase retry on rejection), fetches on a timer and rebases with `-X theirs` so the local version wins per file. A rebase that cannot finish is aborted and reported as `conflict`; `reset` takes the remote version. All git work and writes in the worktree run through one queue in `services/team.ts`.

## Agents

`services/agents.ts` finds programs on PATH, unwraps npm `.cmd` launchers to the real executable (`resolveCommand`), builds the argument list (`claudeArgs`, `basicArgs`) and runs the process with `streamProcess` (no shell; prompt on stdin for Claude Code). Output lines go through `parseClaudeLine` (`shared/agent.ts`) into `AgentEvent`s; the renderer folds them into the transcript with the pure `reduceEvent`. The system prompt comes from `buildSystemPrompt(buildPromptContext(teamData, me, taskId))`.

## Tests

`npm test` runs vitest on the main-process services and the shared logic. Git behaviour is tested against real repositories in temporary folders, including a bare "remote" and two simulated teammates. Docs have guard tests (`tests/manual-docs.test.ts`): chapter parity, shortcuts that exist, labels that exist.

## Extending

- **A theme:** add the id to `ThemeId` (`shared/types.ts`) and to the list in `mergeSettings` (`services/settings.ts`), add an entry to `THEMES` (`theme/themes.ts`), add `theme.<id>` to `en.json` and `th.json`.
- **A language:** add `xx.json` files next to `en*.json`, extend `Lang` and `mergeSettings`, add it to `dicts` in `i18n/index.ts` and to the language selects, and write `resources/manual/xx/`.
- **An agent CLI:** add a row to `KNOWN` in `services/agents.ts`; for a basic one-shot CLI add its flags to `basicArgs`. For full support write a parser like `parseClaudeLine` with a fixture test.
- **A sidebar view / settings section / status item:** create a file under `views/`, push into the matching registry, import it in `main.tsx`.

## Notifications and agent proposals

`shared/notify.ts` (`diffTeam`) compares two reads of the team data and returns what concerns me. `stores/team.ts` runs it on every refresh that was not caused by our own save and calls `teamListeners`; `stores/notices.ts` turns those events into notices and also turns `<tm-assign login title role>brief</tm-assign>` blocks in the agent's answer (`extractAssignments`) into proposals. A proposal creates a task only when approved, and the login must be a team member. Notices live in memory for the open project.

## Languages and Run File

Monaco (full bundle) highlights most languages by extension; `monaco.ts` adds `.ino` (C++) and .NET project files (XML) and configures JS and TS (JSX on, semantic errors off because there are no node_modules types in the editor). `shared/run.ts` (`runLine`) maps an extension to a PowerShell line; `runFile.ts` saves the file and types the line into the terminal (`runInTerminal`). There is no language server: completions beyond JS and TS, go-to-definition and live diagnostics for Python, C, C++ and C# would need one (pyright, clangd, OmniSharp) behind a Monaco LSP client.
