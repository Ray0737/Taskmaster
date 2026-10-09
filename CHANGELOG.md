# Changelog

## Unreleased

- Theme: Claude Dark, the warm charcoal of Claude desktop with a terracotta accent.
- Layout: the activity bar, sidebar, editor, terminal and agent panels are rounded cards on a frame instead of boxes joined by lines.
- Languages: Arduino .ino files are highlighted as C++, .NET project files as XML; JSX and TSX are understood and JS and TS show syntax errors (Python, C, C++, C#, Java, Go and more were already highlighted by Monaco).
- Run File (play button above the code, Ctrl+F5): python, node, tsx, gcc, g++, dotnet, java, go and PowerShell scripts run in the terminal; unsaved edits are saved first.
- Chat: a person icon on your messages, and a "Cooking..." indicator (terminal icon, rotating word, animated dots) while the agent works.
- Markdown preview: right-click a .md file in the Explorer, Open Preview (also a command palette entry). Rendered, read-only, follows unsaved edits.
- Window: a maximized or full-screen window fills the screen (no outer frame, no corner curve); the frame shows only in a smaller window.
- Usage icon now sits with history, help and new chat (same style, shown on hover with them).
- Notifications tab (bell): tasks assigned to you, notes on your tasks, teammates starting a task, and task proposals from your agent.
- Agent proposals: the agent knows the team and can end its answer with a task for a teammate. It appears in Notifications and nothing is created until you press Approve and assign; a login that is not on the team is refused.
- Team view: a member shows "agent running" while their agent answers, and the branch they are on.
- Agent composer: the agent, model and mode pickers are icons (labels in the tooltip), the task picker shortens, and the usage button is a small icon. Usage, model and mode only show while Claude Code is the selected agent.
- Team skills: Import from GitHub. Paste a repo, folder or SKILL.md link, tick the skills found, and the whole skill folder (scripts and reference files too) is copied to the team. Limits: 60 files, 500 KB per file, 1.5 MB per skill. Imported skills show their source and are read-only; a warning appears when scripts are included. Public repos only. When a repo ships the same skill in several folders (skills/x, .claude/skills/x), one is kept: a visible, shallow folder first.
- Tasks: the bulk bar has a one-click Mark done for every selected task.

## 1.1.0

Tasks get screenshots and multi-select, the agent gets a model picker and usage badges, and the window gets a new frame.

- Tasks: `Ctrl+click`, `Shift+click` and `Space` select several tasks; a bar offers Set status, Assign to me and Delete for all of them.
- Tasks: paste a screenshot (`Ctrl+V`) on the task page. It is stored on the team branch (up to 10 per task, 4 MB each), shown as a thumbnail (click to enlarge, Copy path, remove), and the agent is told where it is and may open it. Pasting an image into the agent chat saves it on the selected task and types its path into the message.
- Explorer: new Copy Relative Path next to Copy Path.
- Agent: model picker next to the mode picker (Default, Opus 5.5, Sonnet 5.5, Haiku 5.5, passed as `--model`). Default shows the model the CLI picked. The choice lasts while the app is open. Opus 5.5 needs a newer Claude Code than 2.1.121.
- Agent: a View usage button (title bar and agent panel header) opens claude.ai usage. It is prefixed with the 5hr or 7d percent only when the CLI reports one, which it usually does not.
- Layout: the window is a rounded card inside a thin frame. The agent uses the terminal icon instead of the robot icon.
- Fix: 7 Thai strings were garbled (double-encoded), including the team join toast, the agent context line, the git no-GitHub line, the conflict status and the terminal and editor notices. The English terminal notice also had a broken arrow.
- Tests: 145 unit tests; new e2e scripts 06 (team skills and settings), 07 (themes, Thai at 960 x 600, focus) and 08 (multi-select and screenshots).

## 1.0.0

First stable release: every feature in the design spec is built and verified in the installed app (install, e2e scripts, uninstall). Highlights since the 0.1.0 preview:

- Redesigned UI: custom dropdowns, VS Code style agent composer, underline fields, solid and plain buttons, small curves, dividers between regions, centered empty states, a blank-canvas Home page.
- Settings rebuilt as cards with descriptions: language, theme tabs with a live preview, editor text size, tab size, line numbers, minimap, auto save, terminal font size. Ctrl+= / Ctrl+- / Ctrl+0 change the editor font size.
- Agent panel: Past sessions (search and resume earlier Claude Code conversations), context dialog, no composer without a folder.
- Tasks: a new task opens straight into its page (no title prompt), the task page is redone, and **Delete task** removes a task and its notes for the whole team.
- Team skills: share Claude Code skills through the team branch; each person opts in under Settings, Agents.
- Fixes: switching files now shows the right code; the editor re-measures itself; sidebar and manual share one nav style; no em dashes in the manual.
- Installer: app icon, desktop and Start menu shortcuts, versioned file name.

## 0.1.0 — first release

- VS Code-style shell: activity bar, sidebar, tabs, breadcrumbs, Monaco editor, integrated terminal, status bar, quick open and command palette.
- Themes: Mono Dark (default), Mono Light, Catppuccin Mocha, GitHub Dark. English and Thai, switchable live.
- First-run setup check; sign-in through local Git, Git Credential Manager or the GitHub CLI; git-only mode without GitHub.
- Projects: new (optionally with a GitHub repository), open, clone (GitHub picker or URL), recent list.
- Source Control: stage, unstage, discard, commit, branches, sync, git letters in the Explorer, diffs, open pull request.
- Agent panel: Claude Code with streaming text, tool rows, diffs, cost, sessions per project and task, modes (Read-only, Edit, Full), stop; basic one-shot support for Codex, Gemini, Aider and opencode.
- Team layer on git (`taskmaster/context` branch): roles with editable prompts, tasks with scope globs, notes, presence, GitHub invitations, automatic sync with offline back-off and conflict recovery.
- Start task: task branch, status, agent bound to the task with role, scope, teammates and notes; scope warnings; automatic note capture.
- In-app User Manual (11 chapters, English and Thai) and repository documentation.
