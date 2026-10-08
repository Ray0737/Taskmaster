# Taskmaster

A multiplayer "vibe coding" IDE for Windows. Your team shares one git repository; each person works in their own copy with their own coding agent (Claude Code first), and **roles, tasks, notes and who is online are shared through git itself** — no server, no database.

It looks and behaves like VS Code: activity bar, explorer, Monaco editor, integrated terminal, source control, command palette. Black monochrome by default, plus Catppuccin Mocha and GitHub Dark. English and Thai.

## What you can do

- Create, open or clone a project (GitHub repository picker included) and sign in with the Git and GitHub login you already have.
- Enable Taskmaster for the repository, add teammates, give them roles (Front end, Back end, DB / MCP or your own), and hand out tasks with a brief and a file scope.
- Press **Start task**: Taskmaster creates the task branch, and your agent is told your role, the task, the files it should stay in, what your teammates are doing and their latest notes.
- Chat with Claude Code in the side panel (streaming answers, tool calls, diffs, cost). Other CLIs (Codex, Gemini, Aider, opencode) work in a basic one-shot mode.
- Commit, branch, sync and open pull requests from the Source Control view.
- Share Claude Code skills with your team (Team view, Skills). Delete tasks you no longer need.

## Requirements

- Windows 10 or later
- [Git for Windows](https://git-scm.com/download/win) (includes Git Credential Manager)
- Optional: the GitHub CLI (`gh`), and a coding agent on your PATH such as [Claude Code](https://docs.claude.com/en/docs/claude-code/overview)

## Install

Run `Taskmaster-Setup-<version>.exe` from `dist/` after `npm run build:win`, or use the portable folder `dist/win-unpacked/`. It installs for the current user, with desktop and Start menu shortcuts.
If the project folder is inside Documents or another synced or protected folder, `build:win` can fail with EPERM or EBUSY. Use `npm run build:win:local`, which builds into `%LOCALAPPDATA%\Taskmaster\dist`.
The installer is not code-signed, so Windows SmartScreen may ask you to confirm.

## Develop

```bash
npm install
npm run dev          # start the app with hot reload
npm test             # unit and integration tests (uses real git in temp folders)
npm run typecheck
npm run build        # compile only
npm run build:win    # compile and create the Windows installer in dist/
```

Node 22 or later and Git 2.30 or later are needed for development.

## Documentation

- In the app: **Help → User Manual** (F1), English and Thai.
- [Architecture](docs/ARCHITECTURE.md) — processes, IPC, file formats, how to extend.
- [Contributing](docs/CONTRIBUTING.md) — rules for code, UI, strings and docs.
- [Design spec](docs/superpowers/specs/2026-10-08-taskmaster-design.md) and the [implementation plans](docs/superpowers/plans/).
- [Changelog](CHANGELOG.md)

## Status

Version 0.2.0. Not in this version: real-time co-editing, an in-app merge-conflict editor, in-app pull request review, macOS and Linux builds.
