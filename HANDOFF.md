# Handoff

Written for: whoever continues Taskmaster next (a person, or a model starting a new session).

## State

Version 1.0.0, pushed to https://github.com/Ray0737/Taskmaster.git (`main`). 141 tests pass, `npm run typecheck` is clean. Installer: `npm run build:win:local` writes `%LOCALAPPDATA%\Taskmaster\dist\Taskmaster-Setup-1.0.0.exe` (not code-signed, so SmartScreen warns).

Verified in the installed app: silent install with desktop and Start menu shortcuts, e2e scripts 01, 02, 03 and 05 all PASS, silent uninstall removes everything.

Older details live in `docs/superpowers/sonnet-queue.md`, `docs/ARCHITECTURE.md`, `CHANGELOG.md`.

## Not verified yet

- Team skills UI (Team view, Skills list, add/edit/delete dialog) and the Settings, Agents toggle "Use team skills in the agent" were never looked at in a running app. Only the plugin loading was checked (`claude --plugin-dir` returned the skill's code word).
- Themes other than Mono Dark and Catppuccin Mocha. Keyboard-focus visibility.
- Thai layout at the minimum window size (960 x 600), Thai keyboard shortcuts, very long file names.
- GitHub write actions: create repo, invite collaborator, real pull request page, reconnect login window.
- Sync conflict banner and offline back-off through the UI (the logic is covered by `tests/teamsync.test.ts`).
- Last-minute UI changes were seen only in Mono Dark: Clone dialog hover, composer placeholder height, VS Code style dividers.

## Not built (user said hold off)

- Richer opencode and `agy` adapters. Both have JSON stream output and session flags. opencode: `opencode run --format json -m opencode/<model>`, free models listed by `opencode models`. agy: `--print`, `--output-format stream-json`, `--mode accept-edits|plan`, `--conversation`. Today opencode runs as a basic one-shot agent with its own default model, and agy is not listed.
- Model picker for opencode's free models.
- OmniRoute (https://github.com/diegosouzapw/OmniRoute): local gateway on `localhost:20128`. Unknown: how Claude Code is pointed at it (the README did not show the Anthropic route or env vars). Read its docs and try before building.
- Import skills from `~/.claude/skills`, a "cancelled" task status, a `v1.0.0` git tag and GitHub release.

## Possible IDE features (not decided)

A Markdown viewer is the cheapest: the app already renders Markdown (react-markdown and remark-gfm in the manual and task brief), so a Preview toggle on `.md` tabs is small. Others, by cost: image viewer (png, jpg, svg), find in files (search across the project), JSON/CSV viewers, split editor, minimap and breadcrumbs already exist. Ask the user before adding; keep to the "lazy" rule, reuse what exists.

## Working notes

- Shell here has `ELECTRON_RUN_AS_NODE=1`. Unset it before launching Electron.
- Do not kill processes by name; the user may be running Taskmaster. Test builds go to the scratchpad (`npx electron-builder --win --dir --config.directories.output=<dir>`), not over `%LOCALAPPDATA%\Taskmaster\dist`.
- Run e2e scripts from a short work folder (like `C:\tmf`); git fails on very deep paths. See `scripts/e2e/README.md`.
- Drive the app over CDP: launch with `--remote-debugging-port=<port> --user-data-dir=<scratch>`.
- UI taste (from the user): underline fields, no hover boxes on plain buttons (color change or left accent bar), solid buttons for primary actions, small curves only on a few surfaces, sentence case labels, no em dashes in text, thin dividers between regions like VS Code. Screenshots with notes arrive in `Screenshots/` (git-ignored).
- Never commit credentials. `.gitignore` covers `.env*`, keys, tokens. The GitHub token lives in memory only (`auth.ts`).
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (use the current model's name).
