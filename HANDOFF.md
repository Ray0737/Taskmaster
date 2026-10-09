# Handoff

Written for: whoever continues Taskmaster next (a person, or a model starting a new session).

## State

Version 1.1.0, pushed to https://github.com/Ray0737/Taskmaster.git (`main`). 145 unit tests pass, `npm run typecheck` is clean. Installer: `npm run build:win:local` writes `%LOCALAPPDATA%\Taskmaster\dist\Taskmaster-Setup-1.1.0.exe` (not code-signed, so SmartScreen warns). No `v1.1.0` git tag or GitHub release was made.

New in 1.1.0 (see `CHANGELOG.md`): task multi-select with bulk actions, screenshots on tasks (paste on the task page or in the agent chat, Copy path, the agent can open them), Copy Relative Path in the Explorer, agent model picker, View usage button, rounded window frame, terminal icon for the agent, and the Thai string fix.

Verified on the built 1.1.0 `win-unpacked` app (2026-10-09): e2e 01, 02, 03, 05, 06, 07 all PASS. Script 08 (multi-select, screenshots, chat paste, Copy path, one real agent turn that read a red screenshot) passes every step when run on its own. Run the scripts in this order on a fresh profile and fixture: 01, then 02, 03, 05, 06, 07, 08. Script 03 renames the task to "Login page (edited by B)", and 08 copes with that. Script 01 deletes the fixture folder, which fails with EPERM if the app still has it open, so restart the app first.

Older details live in `docs/superpowers/sonnet-queue.md`, `docs/ARCHITECTURE.md`, `CHANGELOG.md`.

## Not verified yet

- Thai text after the fix: the bundle has no garbled text and the strings are valid, but the team join toast (`team.joined`) was not triggered in the running app.
- Themes: only the background colour was checked. Looks at the other themes (mono-light, mocha, github-dark) were not done by eye; screenshots are in the fixture folder from script 07.
- Keyboard focus: Tab moves through the menu bar and its focus style shows. Other controls (rows, tabs, dropdowns, icon buttons) have `:focus-visible` rules in `base.css` but were not checked in the running app.
- Thai at 960 x 600 was checked with an emulated viewport (`Emulation.setDeviceMetricsOverride`), not a real window resize.
- GitHub write actions: create repo, invite collaborator, real pull request page, reconnect login window. Script 04 exists but needs a real GitHub account and makes real changes, so it was not run.
- Sync conflict banner and offline back-off through the UI (the logic is covered by `tests/teamsync.test.ts`).
- Last-minute UI changes were seen only in Mono Dark: Clone dialog hover, composer placeholder height, VS Code style dividers.
- Agent model picker: Opus 5.5 fails on Claude Code 2.1.121 (needs a newer CLI). Sonnet 5.5 and Haiku 5.5 work. The pick is not saved between app launches.
- View usage opens `https://claude.ai/settings/usage`; the URL was not confirmed to be the right page. The CLI rarely sends a percentage.
- Notifications for teammate events (assigned to you, note on your task, someone started a task) are covered by unit tests of `diffTeam` but were not driven through a real two-person sync in the UI. Agent proposals and presence are covered by e2e script 10.
- Proposals and notifications live in memory only; closing the app drops pending proposals. The raw `<tm-assign>` text still shows in the chat message.
- After the 1.1.0 release (unreleased, see CHANGELOG): GitHub skill import, Mark done, Notifications tab, agent proposals, agent-running presence, compact composer, Markdown preview, full-screen frame, Claude Dark theme, rounded panels, Run File, chat icons. Quit and restart the whole app after pulling: the main process does not hot reload, and a stale one gives "No handler registered" errors.

## Not built (user said hold off)

- Richer opencode and `agy` adapters. Both have JSON stream output and session flags. opencode: `opencode run --format json -m opencode/<model>`, free models listed by `opencode models`. agy: `--print`, `--output-format stream-json`, `--mode accept-edits|plan`, `--conversation`. Today opencode runs as a basic one-shot agent with its own default model, and agy is not listed.
- Model picker for opencode's free models.
- OmniRoute (https://github.com/diegosouzapw/OmniRoute): local gateway on `localhost:20128`. Unknown: how Claude Code is pointed at it (the README did not show the Anthropic route or env vars). Read its docs and try before building.
- Import skills from `~/.claude/skills`, a "cancelled" task status, a `v1.0.0` git tag and GitHub release.

## Future plans (noted by the user, not started)

- Chat app integration, LINE first (the user's idea; scope not decided). LieutenantOS already talks to LINE, Discord and Instagram: reuse what is there before building anything.
- Arduino support: `.ino` files already highlight as C++ and Run File says it is not supported yet. Next step would be `arduino-cli` (compile, upload, board and port pickers, serial monitor in the terminal panel).
- A language server for real IntelliSense in Python, C, C++ and C# (pyright, clangd, OmniSharp). Today only JS and TS complete inside the file, and there are no import diagnostics.
- Missing for a daily-driver IDE: find in files, debugger, a formatter or format on save, extensions, and a way to choose which Python, Node or compiler Run File uses.

## Possible IDE features (not decided)

A Markdown preview (right-click a .md file, Open Preview) now exists.

A Markdown viewer is the cheapest: the app already renders Markdown (react-markdown and remark-gfm in the manual and task brief), so a Preview toggle on `.md` tabs is small. Others, by cost: image viewer (png, jpg, svg), find in files (search across the project), JSON/CSV viewers, split editor, minimap and breadcrumbs already exist. Ask the user before adding; keep to the "lazy" rule, reuse what exists.

## Working notes

- Shell here has `ELECTRON_RUN_AS_NODE=1`. Unset it before launching Electron.
- Do not kill processes by name; the user may be running Taskmaster. Test builds go to the scratchpad (`npx electron-builder --win --dir --config.directories.output=<dir>`), not over `%LOCALAPPDATA%\Taskmaster\dist`.
- Run e2e scripts from a short work folder (like `C:\tmf`); git fails on very deep paths. See `scripts/e2e/README.md`.
- Drive the app over CDP: launch with `--remote-debugging-port=<port> --user-data-dir=<scratch>`.
- Thai i18n files: keep the text as real UTF-8. Editing them through a shell with `\` escapes can corrupt the characters. Check with `grep -rl "à¸" src` (should print nothing).
- UI taste (from the user): underline fields, no hover boxes on plain buttons (color change or left accent bar), solid buttons for primary actions, small curves only on a few surfaces, sentence case labels, no em dashes in text, thin dividers between regions like VS Code. Screenshots with notes arrive in `Screenshots/` (git-ignored).
- Never commit credentials. `.gitignore` covers `.env*`, keys, tokens. The GitHub token lives in memory only (`auth.ts`).
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (use the current model's name).
