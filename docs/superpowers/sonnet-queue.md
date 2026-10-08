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

## Known risky tasks (from the plan handoff, not yet attempted)

- Plan 3 task 2: spawning the agent.
- Plan 4 tasks 3–4: the sync engine.
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
