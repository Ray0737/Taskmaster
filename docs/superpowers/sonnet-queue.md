# Handoff notes — what is verified, what is open

Written for: whoever continues Taskmaster next (a person, or a model).

All five plans are implemented, plus the 0.2.0 UI redesign, Delete task and team skills. Latest full run: 141/141 tests, `tsc --noEmit` clean, `npm run build` clean, Windows installer builds and installs.

## Verified in the packaged app (Sonnet, by driving the UI over the DevTools protocol)

Packaged build, isolated profile, scratch git project with a local bare remote, real Claude Code 2.1.121, real GitHub login (`@Ray0737`).

- Startup: Welcome screen shows Git 2.53, your Git identity, GitHub login, Claude Code. No console errors across all runs.
- Packaged app contents: 11 manual chapters per language, native terminal module present and loading.
- Project: open from Recent, Explorer, preview tab with Monaco, breadcrumbs, quick open (Ctrl+P).
- Git: Explorer letters (M, U), stage all, commit with Ctrl+Enter keeps the exact multi-line message, clean tree afterwards.
- Team: Enable Taskmaster, context branch pushed to the remote, project tree stays clean, task create/start creates `tm/<login>/<id>`, agent context contains the task and team prompt.
- Teammate sync: a teammate's pushed task edit shows in the app; a teammate's damaged task file is skipped without errors.
- Agent: real turn streams, usage footer, memory across turns, Stop works (one spawned process ends), Full mode shows the red warning, note box appears when no `<tm-note>`.
- Help icons: Tasks, Team and Agent open their own chapter. Terminal opens with Ctrl+`.
- Thai: Home screen text is Thai, no horizontal overflow at the default window size.
- Pull request button on a non-GitHub remote shows the "not on GitHub" toast. Pause setting shows in the status bar.

## Fixed while verifying

- `core.longpaths` (commit `5f7635c`): team sync rebase failed with "Filename too long" once the worktree path plus `.taskmaster` files passed 260 characters, so a teammate's push never reached the app. Every git call now passes `-c core.longpaths=true`. Regression test in `tests/git.test.ts`.
- Installer: `npm run build:win` fails with `EPERM`/`EBUSY` on `win-unpacked.tmp` when the output folder is inside the project folder (`dist/` or `release/`). Output outside the project works: `npx electron-builder --win --config.directories.output=<folder outside the project>` produced `Taskmaster Setup 0.1.0.exe` (111 MB). Cause not confirmed; Defender and the search indexer are running, OneDrive is running but `Documents` is not redirected into it. A leftover `release/win-unpacked.tmp` is still locked and ignored by `.gitignore`; delete it after a reboot.

## Correction to earlier notes

- Haiku reported "`npm run dev` launches with no startup errors". That check was invalid: this shell has `ELECTRON_RUN_AS_NODE=1` set, so Electron ran as plain Node and exited at once. Run Electron from a shell where that variable is unset (`Remove-Item Env:ELECTRON_RUN_AS_NODE`).

## Still open

- Version 0.2.0 is verified end to end: silent install from `Taskmaster-Setup-0.2.0.exe` (desktop and Start menu shortcuts), e2e scripts 01, 02, 03 and 05 all PASS against the installed app, silent uninstall removes files and shortcuts. 141 tests, `tsc --noEmit` clean.
- GitHub write actions were not exercised, to avoid public side effects: creating a repository, inviting a collaborator, the real pull request page, Connect/Reconnect login window.
- Not run: sync conflict banner and Reset to remote through the UI, offline back-off through the UI (both covered by `tests/teamsync.test.ts`).
- Not run: Thai layout at the minimum window size (960 x 600), very long file names, Thai keyboard layout shortcuts, all four themes visually (mostly Mono Dark and Catppuccin were looked at), keyboard-focus visibility.
- The installer is not code-signed (Windows SmartScreen asks to confirm).
- Not built (ideas only): richer adapters for opencode and agy (both have JSON stream output and session flags), an OmniRoute gateway setting, importing skills from `~/.claude/skills`, a "cancelled" task status.
- The repo docs say "Node 22 or later"; this machine runs Node 24.

## Plan defects found and fixed (for anyone rerunning the plans)

- Plan 02 Task 1: test used file name `q"uote.txt`, invalid on Windows. Now `q'uote.txt`.
- Plan 02 Task 2: test passed an object literal with an extra property to `toRepoInfo`, a TypeScript error. Added a cast.
- Plan 04 Task 3: `isRejected` missed git 2.53's hint-only push rejection text, so sync never pulled and retried. Pattern widened.
- Plan 04 Task 3 (new): git needs `core.longpaths` on Windows (see above).
- Plan 03: plan says 9 parser tests, the file has 10. Harmless.

## Things to keep in mind

- `auth.ts` keeps the GitHub token in memory only and never logs. A grep confirmed no `log(` calls. Re-check if logging is added there.
- `streamProcess` stops agents with `taskkill /T /F` on Windows and `process.kill(-pid)` elsewhere.
- `teamsync.ts` `pull()` rebases with `-X theirs`: the local file wins per file. The modify/delete conflict test raises `SyncConflict` on git 2.53.
