# Taskmaster — Design Spec

Date: 2026-10-08
Status: draft, awaiting review

## 1. What it is

A local desktop IDE (Electron) for **multiplayer vibecoding**. A team shares one git repo. Each member is assigned a role and tasks, and drives their own coding agent (Claude Code first) inside the app. Tasks, roles, notes and presence are stored as files on a dedicated git branch, so **git is the only shared backend** — no server, no database.

Core flow:
1. Open app → it detects git identity, GitHub login and installed agents.
2. Create a project or link/clone a repo.
3. Add contributors, assign roles (Front end / Back end / DB-MCP / custom) and tasks.
4. Each member starts a task → their agent receives role + task + team context → works → leaves a note.
5. Everyone sees task status, notes and who is online, synced through git every few seconds.

## 2. Scope

In v1:
- VS Code-style shell: activity bar, sidebar, editor tabs (Monaco), agent chat panel, bottom terminal, status bar, command palette, quick open.
- Look and behavior match VS Code closely (§11.1) — someone who knows VS Code should feel at home in 5 seconds.
- Themes: **Dark Mono** (black monochrome, default), **Light Mono**, **Catppuccin Mocha**, **GitHub Dark** (VS Code "GitHub Dark Default"). Token-based; a new theme = one CSS block + one Monaco theme object.
- Documentation: repo docs (README, architecture, contributing) and an in-app bilingual **User Manual** (§12.13, §17).
- Language: English (default) and Thai, switchable live in Settings.
- Sign-in through local git + Git Credential Manager (GCM) / `gh`.
- Git: clone, init, create GitHub repo, branch per task, stage, commit, pull, push, "Open PR" link.
- Agent host: detect CLIs on PATH, chat with Claude Code via `stream-json`, generic adapter for other CLIs.
- Team layer: roles, tasks, notes, presence on branch `taskmaster/context`.

Non-goals v1 (YAGNI): real-time cursors or co-editing, full-text search, extensions, debugger, language servers beyond Monaco built-ins, in-app merge conflict UI for code (use terminal), in-app PR review, macOS/Linux installers (code stays portable).

## 3. Stack

| Concern | Choice | Why |
|---|---|---|
| Shell | Electron + electron-vite, React 18, TypeScript | Local desktop app, fast dev loop |
| Editor | `monaco-editor` via `@monaco-editor/react`, loader pointed at local bundle (no CDN) | Same editor as VS Code, offline |
| Icons | `@vscode/codicons` | Exact VS Code icon set |
| Panes | `react-resizable-panels` | Resizable, keyboard accessible |
| State | `zustand` | Tiny, simple stores |
| Terminal | `xterm` + `@lydell/node-pty` (prebuilt binaries) | No native build tools on Windows |
| Markdown in chat | `react-markdown` + `remark-gfm` | Safe by default (no raw HTML) |
| Glob match | `picomatch` | Task scope check |
| Git | git CLI via `child_process.execFile` | No library, exact git behavior |
| File watch | `fs.watch(dir, {recursive:true})` | Native on Windows |
| Tests | `vitest` | Main-process logic only |
| Package | `electron-builder` (Windows NSIS) | |

No CSS framework. Plain CSS with variables.

## 4. Architecture

```
┌──────────── main process (Node) ─────────────┐      ┌──── renderer (React) ────┐
│ services/                                    │ IPC  │ stores (zustand)         │
│   settings.ts  userData/settings.json        │◄────►│ views/  components/      │
│   auth.ts      git identity + token          │      │ theme/  i18n/            │
│   git.ts       git CLI wrapper               │      └──────────────────────────┘
│   fs.ts        read/write/watch project      │              ▲
│   agents.ts    detect + spawn agent CLIs     │       preload: contextBridge
│   team.ts      .taskmaster read/write        │       exposes typed `api`
│   sync.ts      worktree commit/pull/push loop│
│   pty.ts       terminal sessions             │
└──────────────────────────────────────────────┘
```

Security: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. Preload exposes only the typed `api` object defined in `src/shared/api.ts`. Every IPC handler validates that paths stay inside the open project root (or the userData dir). The token never reaches the renderer; only `{login, name, avatarUrl}` does.

Folder layout:
```
src/
  shared/      api.ts (IPC contract types), types.ts (Task, Team, Note, Presence…)
  main/        index.ts, ipc.ts, services/*.ts
  preload/     index.ts
  renderer/src/
    App.tsx, main.tsx
    theme/     base.css (rules §10.1), themes.css (4 token blocks), monaco-themes.ts
    i18n/      en.json, th.json, index.ts (t(), useT())
    stores/    app.ts, editor.ts, agent.ts, team.ts, git.ts
    components/  ActivityBar, Sidebar, TitleBar, StatusBar, Tabs, Toast, Palette, Button, Input, Select, Empty, Splitter wrappers
    views/     Welcome, Home, Explorer, SourceControl, Tasks, Team, Settings, Editor, AgentPanel, Terminal
tests/         *.test.ts (vitest)
```

## 5. Sign-in (local git, no OAuth app)

1. `git --version`. Missing → Welcome blocks with install link.
2. `git config --global user.name` / `user.email`. Missing → inline inputs on Welcome, saved with `git config --global`.
3. Token, first hit wins:
   - `gh auth token` (if `gh` on PATH)
   - `git credential fill` with input `protocol=https\nhost=github.com\n\n` → read `password=` line (GCM stores the GitHub token there)
4. Token found → `GET https://api.github.com/user` → `{login, name, avatar_url}`.
5. No token → "Connect GitHub" button runs `git credential fill` (same input) with env `GCM_INTERACTIVE=always`. GCM opens its browser login window. On success, run `git credential approve` with the returned lines so GCM stores it, then continue at step 4. Timeout 3 min → back to "Connect GitHub".
6. Still no token → **git-only mode**: everything works except repo picker, GitHub repo creation, collaborator invites, avatars. Status bar shows `GitHub: offline mode`.

Token is kept in main-process memory only. Never written to disk or logs. Cleared on quit.

## 6. Projects

Recent projects list: `userData/recent.json` `[{path, name, lastOpened}]`, max 20.

- **New project**: name, parent folder, toggle "Create GitHub repo" (private by default; needs token → `POST /user/repos`). Runs `git init -b main`, writes README.md, first commit, adds remote, pushes, then enables Taskmaster (§7).
- **Open folder**: must be a git repo (else offer `git init`). If remote has `taskmaster/context` → join. Else show banner "Enable Taskmaster for this repo".
- **Clone**: GitHub repo picker (search box over `GET /user/repos?per_page=100&sort=updated`, paginated) or paste URL. Choose folder. Progress parsed from `git clone --progress` stderr.

## 7. Shared context on git

Branch `taskmaster/context` holds only:
```
.taskmaster/
  team.json                     { "lead": "login", "members": [{ "login", "role", "joinedAt" }], "roles": [{ "id", "label", "prompt" }] }
  tasks/<id>.json               Task
  notes/<taskId>/<iso>-<login>.md   one file per note, never edited
  presence/<login>.json         { "login", "taskId", "branch", "status": "idle|working", "at" }
```
Ids: `t-` + 8 chars base36 random.

Checkout: separate worktree at `<userData>/worktrees/<sha1(repoPath).slice(0,12)>`, so code branches are never touched.
- Remote branch exists → `git worktree add <wt> taskmaster/context`.
- Not exists → `git worktree add --detach <wt>`, then in `<wt>`: `git checkout --orphan taskmaster/context`, `git rm -rf .`, write `team.json` with current user as lead, commit, `git push -u origin taskmaster/context`.

Sync loop (`sync.ts`), per open project:
- Local write → debounce 3 s → `git add -A` → `git commit -m "tm: <login> <summary>"` → push.
- Every 15 s → `git fetch origin taskmaster/context` → if behind, `git rebase -X theirs origin/taskmaster/context`. Note: during rebase "theirs" = our replayed commit, so **local change wins per file**.
- Push rejected → pull-rebase as above, retry once. Still failing → state `conflict`, status bar shows button "Resolve sync" (shows `git status` of worktree + "Reset to remote" action).
- Network error → state `offline`, retry backoff 15 s → 30 s → 60 s → max 5 min.
- After every successful fetch/rebase, main re-reads changed files and pushes an `team:changed` IPC event.

Conflict model: notes and presence have a single writer per file → never conflict. `tasks/*.json` and `team.json` can be edited by more than one person → last push wins per file.
`ponytail:` presence heartbeat commits every 60 s per user; branch history grows. Ceiling: thousands of commits/day on big teams. Upgrade path: periodic squash of `taskmaster/context` by the lead.

Presence: written when status/task/branch changes and every 60 s heartbeat. Member shown offline if `at` older than 3 min.

## 8. Roles and tasks

Role presets (editable, stored in `team.json.roles`):
| id | label EN | label TH | starter prompt (short) |
|---|---|---|---|
| frontend | Front end | ฟรอนต์เอนด์ | UI, components, styling, client state |
| backend | Back end | แบ็กเอนด์ | API, server logic, auth |
| data | DB / MCP | ฐานข้อมูล / MCP | schema, migrations, MCP servers, integrations |
| custom | Custom | กำหนดเอง | user-written |

Task:
```ts
type Task = {
  id: string; title: string; brief: string;        // brief = markdown
  role: string; assignee: string | null;           // login
  status: 'todo' | 'doing' | 'review' | 'done';
  files: string[];                                 // scope globs, e.g. ["src/ui/**"]
  branch: string | null;                           // tm/<login>/<id>
  createdBy: string; createdAt: string; updatedAt: string;
}
```

Start task (button on task):
1. Status → `doing`, assignee → me if empty.
2. Code repo: `git switch -c tm/<login>/<id>` from default branch (or switch if exists). Uncommitted changes → dialog "Stash / Commit / Cancel".
3. Agent panel binds to this task, builds the prompt (§9.3).

Finish: agent's note saved → status `review`. Source Control view shows "Open PR" → opens `https://github.com/<owner>/<repo>/compare/<default>...<branch>?expand=1` in the browser. Anyone sets `done`.

Scope warning: when the agent's tool call writes a path not matching `task.files` (picomatch) → inline row in chat "Outside task scope: path". Not blocked. Empty `files` = no check.

## 9. Agent host

### 9.1 Detection
Scan `process.env.PATH` dirs × `PATHEXT` for known names: `claude`, `codex`, `gemini`, `aider`, `opencode`. For each found run `<cmd> --version` (timeout 5 s). Result list cached; "Rescan" in Settings.

### 9.2 Adapters
```ts
type AgentAdapter = {
  id: string; label: string; bin: string;
  args(o: { prompt: string; system: string; sessionId?: string; mode: Mode }): string[];
  parse: 'claude-stream' | 'text';
}
```
- **claude**: `claude -p <prompt> --output-format stream-json --verbose --include-partial-messages --append-system-prompt <system> --permission-mode <mode> [--resume <sessionId>]`. Parse NDJSON: `system/init` (session_id), `stream_event` (text deltas), `assistant` (text + tool_use blocks), `user` (tool_result), `result` (usage, cost, is_error).
- **generic** (codex/gemini/aider/opencode): system + prompt joined into one prompt, run one-shot, stdout streamed as plain text. No sessions, no tool rows. Labelled "basic support".

Modes (claude): `Read-only` → `plan`, `Edit` → `acceptEdits` (default), `Full` → `bypassPermissions` (shown with warning text "Agent can run any command").

Process: cwd = project root. Stop = kill process tree (`taskkill /pid <pid> /T /F` on Windows, `kill -TERM -pid` elsewhere). Sessions `{taskId → sessionId}` stored in `userData/sessions/<repoHash>.json` (machine-local, never synced).

### 9.3 Prompt assembly (`buildSystemPrompt`, pure function, unit tested)
```
You are working in a team project managed by Taskmaster.
Your role: <role label> — <role prompt>
Your task: <title>
<brief>
Stay inside these files when possible: <globs or "any">
Team right now:
- @<login> (<role>) doing "<task title>"   (only status=doing, other members)
Recent notes (newest first, max 5, each trimmed to 400 chars):
- [<task title>] @<login>: <text>
When you finish, end your final message with:
<tm-note>2–5 lines: what you changed, what others should know</tm-note>
```
Total capped at 6000 chars (drop oldest notes first). Context chip in the agent header opens a read-only preview of exactly this text.

Note capture: on `result`, regex `<tm-note>([\s\S]*?)</tm-note>` on final assistant text → write note → task status `review`. No tag → "Save note" button with an editable textarea prefilled with the last assistant message (first 600 chars).

## 10. Visual system

### 10.1 Hard rules
- `border-radius: 0` everywhere (global `*, *::before, *::after { border-radius: 0 !important; }`).
- No borders, outlines or box-shadows on interactive elements. Separation between regions comes from background steps.
- Hover = background color change only. Selected/active = stronger background. Keyboard focus (`:focus-visible`) = its own background color — color only, but always visible (accessibility).
- Every scroll region: `overflow: auto`, styled scrollbar (10 px, square thumb, `--scroll` / `--scroll-hover`). Every flex/grid child that holds content: `min-width: 0; min-height: 0`.
- Single-line labels (file names, task titles, branch names, member names): `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` + `title` attribute for full text.
- Code blocks and long lines in chat scroll horizontally inside their box; the chat panel itself never scrolls horizontally.
- Window minimum size 960×600. Panels have min sizes so nothing collapses into overlap.
- Transitions: `background-color 80ms linear` only. No motion otherwise.

### 10.2 Tokens
Four themes. Ids: `mono-dark` (default), `mono-light`, `mocha`, `github-dark`.

| Token | Mono Dark | Mono Light | Catppuccin Mocha | GitHub Dark | Use |
|---|---|---|---|---|---|
| `--bg-0` | #000000 | #ffffff | #1e1e2e base | #0d1117 | editor, tab strip active tab, breadcrumbs |
| `--bg-1` | #0b0b0b | #f5f5f5 | #181825 mantle | #010409 | sidebar, agent panel, bottom panel |
| `--bg-bar` | #000000 | #ececec | #11111b crust | #010409 | title bar, activity bar, status bar, inactive tab strip |
| `--bg-2` | #141414 | #ebebeb | #313244 surface0 | #161b22 | inputs, dropdowns, user chat message, palette |
| `--hover` | #1c1c1c | #e0e0e0 | #2a2b3c | #1c2128 | hover background |
| `--selected` | #262626 | #d4d4d4 | #45475a surface1 | #262c36 | active tab, selected row, active activity icon |
| `--focus` | #333333 | #c4c4c4 | #585b70 surface2 | #30363d | `:focus-visible` background |
| `--fg` | #e8e8e8 | #111111 | #cdd6f4 text | #e6edf3 | main text |
| `--fg-dim` | #9a9a9a | #555555 | #a6adc8 subtext0 | #9198a1 | secondary text (≥4.5:1 on bg-1) |
| `--fg-faint` | #6a6a6a | #8a8a8a | #6c7086 overlay0 | #6e7681 | placeholders, disabled only |
| `--accent` | #ffffff | #000000 | #cba6f7 mauve | #2f81f7 | active-item indicator bar, links, badges, progress |
| `--inv-bg` | #e8e8e8 | #111111 | #cba6f7 mauve | #238636 | primary button background |
| `--inv-fg` | #000000 | #ffffff | #11111b crust | #ffffff | primary button text |
| `--inv-hover` | #ffffff | #333333 | #b4befe lavender | #2ea043 | primary button hover |
| `--danger` | #ff6b6b | #c62828 | #f38ba8 red | #f85149 | errors, destructive, "Full" mode warning |
| `--ok` | #e8e8e8 | #111111 | #a6e3a1 green | #3fb950 | checks passed, git "A" |
| `--warn` | #e8e8e8 | #111111 | #f9e2af yellow | #d29922 | scope warning, git "M" |
| `--diff-add` | #1a2e1a | #e3f3e3 | #323c3f | #12261e | Monaco diff only |
| `--diff-del` | #331a1a | #f8e1e1 | #3e2e40 | #25171c | Monaco diff only |
| `--scroll` | #2a2a2a | #cfcfcf | #45475a | #30363d | scrollbar thumb |
| `--scroll-hover` | #3d3d3d | #b0b0b0 | #585b70 | #484f58 | |

Mono themes stay strictly gray: `--ok`/`--warn`/`--accent` equal `--fg`, meaning comes from icon + text; `--danger` is the only color. Mocha and GitHub Dark use their real palettes.

Theme switch = `document.documentElement.dataset.theme = <id>` + `monaco.editor.setTheme('tm-<id>')` + update `titleBarOverlay` colors via IPC. All theme CSS in `theme/themes.css` (one `[data-theme=…]` block each).

### 10.2.1 Syntax colors (Monaco token rules)
| Token | Mono Dark | Mono Light | Mocha | GitHub Dark |
|---|---|---|---|---|
| comment | #6a6a6a italic | #8a8a8a italic | #9399b2 overlay2 italic | #8b949e |
| keyword | #ffffff bold | #000000 bold | #cba6f7 mauve | #ff7b72 |
| string | #b5b5b5 | #444444 | #a6e3a1 green | #a5d6ff |
| number / constant | #d0d0d0 | #333333 | #fab387 peach | #79c0ff |
| function | #f0f0f0 | #111111 | #89b4fa blue | #d2a8ff |
| type / class | #dcdcdc italic | #222222 italic | #f9e2af yellow | #ffa657 |
| variable | #e8e8e8 | #111111 | #cdd6f4 text | #e6edf3 |
| operator / delimiter | #8a8a8a | #666666 | #89dceb sky | #e6edf3 |
| tag (html/jsx) | #ffffff | #000000 | #cba6f7 mauve | #7ee787 |
| attribute | #b5b5b5 | #444444 | #f9e2af yellow | #79c0ff |

Settings → General → Theme shows 4 box swatches (name + 5 color squares). Hover = background change, selected = `--selected`.

### 10.3 Type and spacing
- UI font: `"Segoe UI", "Leelawadee UI", "Noto Sans Thai", system-ui, sans-serif` (Leelawadee UI is the Windows Thai font, nothing to bundle). 13 px base, 11 px for status bar and section headers (uppercase in EN, normal in TH).
- Code font: `"Cascadia Code", Consolas, "Courier New", monospace`, 13 px, user-adjustable 10–24.
- Line height 1.5 for Thai readability (Thai has upper/lower vowel marks).
- Spacing scale: 4 / 8 / 12 / 16 / 24 px. Row height 22 px (tree, lists), 28 px (inputs/buttons), 35 px (tabs, title bar).

## 11. Layout

```
┌─ TitleBar 35px ── [≡ menu]  project-name — [ Search files (Ctrl+P) ]       [_][□][X] ┐
├──┬─────────────┬────────────────────────────────────┬────────────────────────────────┤
│A │ SIDEBAR     │ TABS: App.tsx ● | api.ts | ×        │ AGENT  [Claude ▾][Task ▾][Edit▾]│
│c │ (Explorer/  ├────────────────────────────────────┤ ───────────────────────────────│
│t │  Git/Tasks/ │                                    │ messages (scroll)              │
│i │  Team)      │   Monaco editor / diff / welcome   │                                │
│v │             │                                    │                                │
│i │             ├────────────────────────────────────┤                                │
│t │             │ PANEL: Terminal (Ctrl+`)           │ ───────────────────────────────│
│y │             │                                    │ [ message input        ][Send] │
├──┴─────────────┴────────────────────────────────────┴────────────────────────────────┤
│ StatusBar 22px: ⎇ tm/ray/t-ab12 · ⟳ synced 4s · ● 3 online   │ Claude idle · EN · Dark │
└───────────────────────────────────────────────────────────────────────────────────────┘
```
- Activity bar 48 px. Icons top: Explorer, Source Control, Tasks, Team. Bottom: Account (avatar/initial), Settings. Badge counts as small inverted squares (changes count, my open tasks).
- Clicking the active activity icon toggles the sidebar (VS Code behavior).
- Sidebar default 260 px (min 180, max 480). Agent panel default 380 px (min 300, max 50% window). Bottom panel default 30% height (min 100 px). Sizes and visibility persisted in settings.
- Title bar: `titleBarStyle: 'hidden'` + `titleBarOverlay` (native Windows buttons, colors from theme). App icon, then text menu bar (File, Edit, View, Go, Terminal, Help — box dropdowns), center Command Center box opens Quick Open.

### 11.1 VS Code fidelity checklist
The executor must match these. Reference: VS Code 1.9x default layout.
| Element | Spec |
|---|---|
| Title bar | 35 px, `--bg-bar`. Menu items 13 px, padding 0 8 px, hover `--hover`. Command Center: 24 px tall, 38% width (min 200, max 600), `--bg-2`, codicon `search` + "project-name", centered |
| Activity bar | 48 px wide, `--bg-bar`. Icons codicons 24 px, cell 48×48, `--fg-faint` idle, `--fg` hover/active. Active cell: 2 px `--accent` bar on left edge (drawn with `::before` background, not a border) |
| Sidebar | Title row 35 px: view name uppercase 11 px `--fg-dim` + action icons right (shown on sidebar hover). Collapsible section headers 22 px, 11 px bold uppercase, chevron |
| Tree rows | 22 px, indent 8 px per level + 16 px chevron column, 1 px indent guides `--selected` shown on sidebar hover. Selected row `--selected`; focused+selected row `--focus` |
| Tabs | 35 px, `--bg-bar` strip, inactive tab `--bg-bar` text `--fg-dim`, active tab `--bg-0` text `--fg` + 1 px `--accent` bar at top (pseudo-element). Width fits content (min 80, max 240), file icon + name + close/dirty slot 20 px |
| Breadcrumbs | 22 px under tabs, `--bg-0`, path segments `›` separated, 12 px `--fg-dim`, hover `--fg`; click segment → dropdown of siblings |
| Editor | Monaco: font 14 px, minimap on, sticky scroll on, bracket-pair colorization on, smooth scrolling off, `renderLineHighlight: 'all'`, scrollbar 10 px |
| Panel | Tab row 35 px: `TERMINAL` (11 px uppercase), active tab 1 px `--accent` underline, actions right (new terminal, kill, maximize, close) |
| Secondary sidebar (agent) | Same chrome as sidebar: title row `AGENT` + icons |
| Status bar | 22 px, `--bg-bar`, 12 px, items padding 0 6 px, hover `--hover`. Left: branch, sync, presence. Right: agent, language, theme, bell |
| Scrollbars | 10 px, square thumb, track transparent, visible on hover of container only (like VS Code) |
| Context menus / dropdowns | `--bg-2`, rows 24 px, padding 0 24 px, hover `--selected`, separators as 1 px `--hover` gap rows, keybinding hint right-aligned `--fg-dim` |
| Quick input (palette) | 600 px, top offset 8 px below title bar, `--bg-2`, input row 26 px, list rows 22 px, match highlight in `--accent` bold |
| Notifications | 450 px wide, bottom-right above status bar, `--bg-2` |

Indicator bars (activity, tab, panel tab) are the only lines in the UI — they mark *state*, never hover, so they keep the "hover = color only" rule.

## 12. Screens and flows

### 12.1 Welcome (first run, and from Help → "Setup check")
Full window, centered column 560 px, scrolls if short window. Language toggle `EN | TH` top right.
Checklist of boxes, each row: icon (check / x / spinner), label, detail, action:
1. Git — `git version 2.53` / "Not found" + [Download Git]
2. Identity — `Ray <ray@…>` / inline name + email inputs + [Save]
3. GitHub — `@login` with avatar / [Connect GitHub] / "Skip — git-only mode"
4. Agents — one sub-row per detected agent with version; none → "No coding agent found" + [How to install Claude Code] (opens docs URL)
Bottom: [Continue] primary, enabled once Git + Identity pass.

### 12.2 Home (no project open)
Two columns (stack under 900 px wide):
- Left "Start": [New project] [Open folder] [Clone repository] — full-width box buttons with icon + one-line description.
- Right "Recent": list rows (name, path dim, last opened relative). Hover reveals [×] remove-from-list. Empty → "No recent projects".

Clone dialog: tabs `GitHub` | `URL`. GitHub tab: search input + repo list (name, owner, private badge, updated). Choose folder row. [Clone] → progress row with percent, cancel.

### 12.3 Project open — first time
- Repo without Taskmaster → banner on top of editor area: "Taskmaster is not enabled for this repo. [Enable] [Not now]".
- Lead after enable → Team view opens with an onboarding box: "1. Add people 2. Set roles 3. Create tasks", each line a link.
- Member joining → toast "You are @ray — Front end. 2 tasks assigned to you. [Open Tasks]".

### 12.4 Explorer
Tree of project files, loaded lazily per folder on expand. Hides `.git` and `node_modules`; everything else shown (`ponytail:` no `.gitignore` greying in v1; upgrade path: one `git check-ignore --stdin` call per expanded folder). Row: chevron, codicon by type, name, git status letter on right (M in `--warn`, A/U in `--ok`, D in `--danger`). Context menu: New file, New folder, Rename, Delete (confirm), Reveal in Explorer, Copy path. Toolbar on section header (visible on hover): new file, new folder, refresh, collapse all. Live refresh from `fs.watch`.

### 12.5 Editor
- Tabs: name + dirty dot ●, hover shows × , middle-click closes, overflow scrolls horizontally with wheel. Preview tab (italic) on single click, pinned on edit or double click — VS Code behavior.
- Ctrl+S save. Auto-save setting: off / after delay (1 s).
- File changed on disk (agent edits): not dirty → reload silently and flash the tab background once; dirty → bar above editor "File changed on disk. [Reload] [Keep mine] [Compare]".
- Agent changes show as clickable chips in chat → open Monaco diff (HEAD vs working copy).
- Binary → "Binary file — not shown". > 5 MB → read-only with notice.
- No tabs open → empty state with shortcuts list (Ctrl+P, Ctrl+Shift+P, Ctrl+`, Ctrl+L).

### 12.6 Source Control
- Header: current branch (click → branch picker: list + "Create branch").
- Commit input (multi-line, Ctrl+Enter commits) + [Commit] primary.
- Sections "Staged" / "Changes": rows with status letter; hover actions stage/unstage/discard (discard asks confirm). Click → diff tab.
- [Sync] = pull --rebase then push; shows ahead/behind `↑2 ↓0`.
- On `tm/*` branch with commits → [Open PR] button.
- Pull conflict → message "Conflicts in N files — resolve in terminal" + [Open terminal]. (Merge UI is a non-goal.)

### 12.7 Tasks
- Filter row: `Mine | All` toggle + role select.
- Groups: Doing, To do, Review, Done (Done collapsed by default). Group header shows count.
- Row: status square, title (ellipsis), role tag, assignee initial box. Click → Task detail in the editor area as a tab.
- [+ New task] on header.
- Task detail tab: title (inline edit), brief (markdown edit / preview toggle), role select, assignee select, status select, scope globs (chip input), branch, notes list (newest first, author + time), actions: [Start task] primary / [Mark review] / [Mark done].

### 12.8 Team
- Members list: avatar/initial square, @login, role select (lead can edit; others see text), presence: `working on "<task>"` / `idle` / `offline 12m`.
- [Add member]: with token → search collaborators (`GET /repos/{o}/{r}/collaborators`) or type a login → if not a collaborator, `PUT /repos/{o}/{r}/collaborators/{login}` (invite). Without token → add by login, show "Invite them on GitHub manually" + link to repo settings.
- Roles section: list of roles with edit prompt (textarea) and [Add role].

### 12.9 Agent panel
- Header row: agent select (detected only), task select ("No task" allowed → plain chat with no team prompt), mode select (Read-only / Edit / Full — Full shows text in `--danger`), [New chat] icon, context chip "Context ▸" (opens preview).
- Messages:
  - User: box with `--bg-2`.
  - Assistant: markdown on panel background, code blocks in `--bg-0` boxes with copy icon, horizontal scroll inside.
  - Tool calls: one 22 px row each, codicon + verb + target (`Edit src/App.tsx`, `Run npm test`), click expands input/result (result capped at 200 lines, scroll inside). File targets are chips that open diff.
  - Scope warning row and errors in `--danger` text.
  - Streaming text appears live; auto-scroll sticks to bottom unless user scrolled up → "↓ New messages" box button.
- Busy: input stays editable, [Send] becomes [Stop]; header shows `Working · 12s`.
- Input: textarea autosizes up to 40% of panel height then scrolls. Enter sends, Shift+Enter newline. Disabled with reason text when no agent is detected.
- Footer (11 px, dim): `in 12.3k · out 1.1k · $0.04` from the `result` event (claude only).
- Note capture box appears at end of turn when `<tm-note>` found: "Note saved to task ✓ [Edit]".

### 12.10 Settings (editor tab, not a modal)
Sections with left nav list: General (language, theme), Editor (font size, auto-save, word wrap), Agents (detected list + versions, default agent, default mode, [Rescan]), Sync (fetch interval 15/30/60 s, pause sync), Account (identity, GitHub status, [Reconnect]). Every change applies live and saves to `userData/settings.json`.

### 12.11 Command palette and quick open
- Ctrl+P: fuzzy file finder over project file list (cached, refreshed on fs events). `ponytail:` simple subsequence scoring; ceiling ~50k files; upgrade path: worker + fzf-style scorer.
- Ctrl+Shift+P: commands (every menu action + "Toggle theme", "Switch language", "Start task…", "New task", "Sync now", "Setup check").
- Box at top center, 600 px wide, list max 12 rows visible then scroll. ↑/↓/Enter/Esc.

### 12.12 Feedback
- Toasts: bottom-right stack, max 3, box `--bg-2`, auto-hide 5 s (errors stay until closed). Optional action button.
- Confirm dialogs: centered box, title, text, [Cancel] [Confirm] (destructive confirm in `--danger` background). Esc cancels, Enter confirms.
- Every list has an empty state (one line of dim text + optional action). Every async action shows inline progress where it happens, not a global spinner.

### 12.13 User Manual (in-app)
- Opens as an editor tab: Help → User Manual, `F1`, Welcome link, and `?` icons next to Tasks/Team/Agent headers (open the matching chapter).
- Layout inside tab: left chapter list (200 px, filter box on top), right rendered markdown (max text width 760 px, scrolls). Language follows app setting; switch EN/TH at top right of the tab.
- Source: `resources/manual/en/NN-slug.md` and `resources/manual/th/NN-slug.md`, bundled with the app (offline). Filter = substring match over chapter titles + headings.
- Chapters:
  1. Getting started — what Taskmaster is, first-run checklist
  2. Sign in — git identity, GitHub via GCM / `gh`, git-only mode
  3. Projects — new, open, clone, enable Taskmaster
  4. Team & roles — add members, invites, role prompts, lead
  5. Tasks — create, scope globs, start, review, done, branches and PRs
  6. Agents — supported agents, modes, context preview, notes, scope warnings, stop
  7. Source control — stage, commit, sync, open PR, conflicts via terminal
  8. Sync & offline — how `taskmaster/context` works, last-push-wins, conflict resolve
  9. Themes & language
  10. Keyboard shortcuts
  11. Troubleshooting — every row of §14 as "Symptom → Fix"
- A vitest test fails if a chapter exists in `en/` but not in `th/`.

### 12.14 Shortcuts
| Keys | Action |
|---|---|
| Ctrl+P | Quick open |
| Ctrl+Shift+P | Command palette |
| Ctrl+B | Toggle sidebar |
| Ctrl+Alt+B | Toggle agent panel |
| Ctrl+` | Toggle terminal |
| Ctrl+L | Focus agent input |
| Ctrl+S / Ctrl+W | Save / close tab |
| Ctrl+Tab | Next tab |
| Ctrl+Shift+E / G | Explorer / Source Control |
| Ctrl+, | Settings |
| F1 | User Manual |

## 13. i18n
- `en.json`, `th.json`: flat keys (`"tasks.new": "New task"`). `t(key, vars?)` with `{name}` interpolation. Missing TH key falls back to EN. A vitest test fails if `th.json` lacks a key that `en.json` has.
- Language change re-renders live, no restart. Monaco UI stays English (its own built-in strings).
- Thai copy uses natural Thai with English tech terms kept as-is (commit, branch, push, agent).

## 14. Error handling
| Situation | Behavior |
|---|---|
| git not installed | Welcome blocks; install link |
| No GitHub token | git-only mode, features needing API show a reason instead of a button |
| Clone/push auth failure | Toast with git's last stderr line + [Reconnect GitHub] |
| Push rejected (code) | Message "Remote has new commits — [Sync]" |
| Context sync conflict | Status bar `Sync conflict` → resolve view (§7) |
| Offline | Status `Offline — retrying in 30s`; local edits keep working and queue |
| Agent not found / removed | Input disabled with reason + [Rescan] |
| Agent not logged in (stderr/result mentions login or API key) | Error box + [Open terminal] that runs `claude` so the user logs in |
| Agent crash / non-zero exit | Error box with last 20 stderr lines (scroll) + [Retry] |
| File deleted while open | Tab shows strike-through name, editor read-only, [Close] |
| Path outside project in IPC | Rejected in main, logged, renderer gets error |
| Unhandled renderer error | Error boundary per region (sidebar / editor / agent) with [Reload view] — one crash never blanks the whole app |

Logs: `userData/logs/main.log`, rotated at 5 MB. Help → "Open logs folder".

## 15. Testing
`vitest`, main-process and shared pure logic only:
- `buildSystemPrompt` — fields present, 6000-char cap drops oldest notes first.
- Claude stream parser — feed recorded NDJSON fixture → expected message/tool/result events.
- Note extraction regex.
- Agent detection — temp dir with fake `claude.cmd` on a fake PATH.
- Scope check — globs vs paths.
- Presence offline calc.
- Sync — real git: temp bare repo + two worktree clients, write from A, sync B, assert B sees it; both edit same task → last push wins; no crash.
- i18n key parity.

Renderer: manual smoke checklist in the plan (open app, each view, theme + language switch, resize to min window, long file name, long chat code line → no overflow).

## 16. Build order
1. **Shell** — scaffold, 4 themes, i18n, layout per §11.1, explorer, editor, terminal, palette, settings, manual viewer.
2. **Git + auth** — welcome checks, identity, token, home, new/open/clone, source control.
3. **Agent host** — detection, claude adapter + parser, chat panel, sessions, generic adapter.
4. **Team layer** — worktree, sync loop, tasks, team, presence, prompt assembly, note capture, start-task flow.
5. **Docs** — manual chapters EN + TH, repo docs (§17), screenshots.

## 17. Documentation
Repo docs (English):
- `README.md` — what it is, screenshot, requirements (Windows 10+, git, optional `gh`, Claude Code), install, dev (`npm i`, `npm run dev`), build (`npm run build:win`), test (`npm test`).
- `docs/ARCHITECTURE.md` — §4 diagram, services and their IPC channels, `.taskmaster/` file formats, sync loop, how to add a theme / agent adapter / language.
- `docs/CONTRIBUTING.md` — code style, UI rules (§10.1, §11.1) as a checklist, test command, commit format.
- `CHANGELOG.md` — started at 0.1.0.

In-app manual: §12.13. Manual chapters are written last (step 5) so they describe the real UI; each UI step in the plan lists which chapter it affects.

Each step ends runnable. The implementation plan will split each into small tasks with exact file paths and a done-check, sized for execution by a smaller model.
