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

## Plan 04-team: in progress (Haiku)

- Tasks 1–4 done. Commits `2dde232` to `9b99785`. 125/125 tests.
- Plan defect, fixed: `isRejected` in `teamsync.ts` matched only `[rejected]`, `non-fast-forward`, `fetch first`. Git 2.53 prints push rejections as hint lines (`integrate the remote changes`, `fast-forwards`), and `lastLines()` keeps only the last three lines. Without this fix the sync engine never pulled and retried. Added the hint text to the pattern.
- Concern: `teamsync.ts` `pull()` uses `rebase -X theirs`. The modify/delete conflict test passed on git 2.53, so the plan's "may not raise SyncConflict" fallback was not needed.
- NOT yet done: Tasks 5–7 (store, Tasks/Team views, agent integration, PR button).

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
