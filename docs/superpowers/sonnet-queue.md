# Sonnet queue — tasks too complex for Haiku

Written for: Sonnet picking up a task Haiku got stuck on.

Rule: Haiku hits the same failure twice → stop, add entry here, move on or wait.

## Known risky tasks (from the plan handoff, not yet attempted)

- Plan 1 Task 1 `npm run dev` smoke check — needs a GUI, check by hand.
- Plan 2 tasks 2–3: git and sign-in.
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
