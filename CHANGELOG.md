# Changelog

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
