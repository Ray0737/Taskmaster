# Sonnet queue — tasks too complex for Haiku

Written for: Sonnet picking up a task Haiku got stuck on.

Rule: Haiku hits the same failure twice → stop, add entry here, move on or wait.

## Status

- Plan 01-shell: all 11 tasks done by Haiku, 27/27 tests, build green. `npm run dev` launches with no startup errors (45 s run). Manual smoke checklist (Task 11 Step 10) not ticked: needs a person at the window.
- Plan 02–05: not started.

## Plan 02-git-auth: done by Haiku, with notes for review

- Built: all 5 tasks, 46/46 tests, typecheck and build green. Commits `f52dc65` to `dc6ec33`.
- Plan defect, fixed: `tests/git.test.ts` used a file named `q"uote.txt`. Windows forbids `"` in names, so the test could not run. Replaced with `q'uote.txt`. Sonnet: keep the quote-handling check, but any other Windows-invalid name also needs changing in the plan.
- Plan defect, fixed: `tests/auth.test.ts` passed an object literal with an extra `extra` field to `toRepoInfo`. TypeScript rejects excess properties in literals, so typecheck failed. Added an `as` cast in the test.
- NOT verified (needs a real GitHub account and a human): sign-in through Git Credential Manager, `gh` token path, creating a GitHub repo, pushing to a real remote, sync conflict toast, Thai UI on the Welcome screen.
- Concern for Sonnet: `auth.ts` keeps the token in a module variable. The plan says it never logs, and a grep confirmed no `log(` calls. Re-check any future change that adds logging in that file.

## Plan 03-agents: done by Haiku, with notes for review

- Built: all 5 tasks. Commits `1028c2c` to `e4fdee9`. Typecheck and build green.
- Real CLI check: one real `claude -p --output-format stream-json` call (prompt via stdin) exited 0 and returned `PONG`, cost about $0.10. Its result line is kept as `tests/agent-real.test.ts`.
- NOT verified (needs a person at the app): Stop kills the real child tree, session resume after restart, Full/Edit/Read-only modes, the Retry path, Thai layout of the panel.
- Plan count mismatch, harmless: the plan says 9 parser tests, the file has 10.
- Concern for Sonnet: `streamProcess` uses `taskkill /T /F` on Windows and `process.kill(-pid)` elsewhere. The Windows stop path is only covered by the fake-process test, not a real `claude.exe`.

## Plan 04-team: done by Haiku (Tasks 1–7)

- All 7 tasks built. Commits `2dde232` to `ab804d1`. Last full run: 131/131 tests, typecheck and `npm run build` green.
- Tasks 6–7 (Team view, sync item, enable banner, sync settings, open PR) are in one commit, not two. Not verified in the app: the two-person GitHub smoke test in Task 6 Step 5.
- Plan defect, fixed: `isRejected` in `teamsync.ts` matched only `[rejected]`, `non-fast-forward`, `fetch first`. Git 2.53 prints push rejections as hint lines (`integrate the remote changes`, `fast-forwards`), and `lastLines()` keeps only the last three lines. Without this fix the sync engine never pulled and retried. Added the hint text to the pattern.
- Concern: `teamsync.ts` `pull()` uses `rebase -X theirs`. The modify/delete conflict test passed on git 2.53, so the plan's "may not raise SyncConflict" fallback was not needed.
- Tasks 5–7 done (see the section above).

## Plan 05-docs: Tasks 1–3 done, Task 4 partly done (Haiku)

- Manual: 11 chapters EN and TH, guard tests green (`tests/manual-docs.test.ts`). Commits `22d4929` (and the Thai commit before it).
- Repo docs: README, CHANGELOG, `docs/ARCHITECTURE.md`, `docs/CONTRIBUTING.md`. Commit `6976131`.
- Help "?" icons on Tasks, Team and Agent headers. Commit `4230ae5`.
- BLOCKED: `npm run build:win` (installer). Electron-builder fails at the packaging step with `EPERM` on `win-unpacked.tmp` rename, and later `EBUSY` on `default_app.asar`. Happened with output in `dist/` and in `release/`. Suspect: the project sits under `Documents`, possibly synced by OneDrive or another file-sync client, which locks new files. Not confirmed. Next step for Sonnet: check for a sync client (`Get-Process OneDrive`), or build from a folder outside `Documents`, then re-run the Task 4 Step 4 checks.
- NOT done: Task 4 Step 5 (the manual-vs-app walkthrough) and Plan 05's app checks. Need a person at the app.
- Plan defect to fix before Sonnet reruns it: the repo docs say "Node 22 or later", but this machine runs Node 24. Harmless, but doc and reality differ.

## Known risky tasks (from the plan handoff, not yet attempted)

- Manual smoke checklists at the end of each task — user runs the app.

## Stuck entries

_(none yet)_

Template:

```
### <plan> task <n> — <short title>
- Failing step: <command>
- Exact error: <one line>
- What Haiku tried: <list>
- Files touched: <paths>
- Status: open | done
```
