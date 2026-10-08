# Contributing

## Setup

`npm install`, then `npm run dev`. Run `npm run typecheck && npm test` before every commit. Git 2.30+ and Node 22+ are required.

## Code

- TypeScript strict. Prefer the smallest change that is correct; reuse what exists (helpers, registries, stores) before adding anything new.
- Anything that touches git, paths or processes goes through the existing services. Git is only run with `execFile` and an argument array, never a command string. Never log tokens or credentials.
- Everything that comes from a file a teammate wrote, from agent output or from the network is untrusted: validate it (see `shared/team.ts`).
- Non-trivial logic gets a test that fails if the logic breaks. Git behaviour is tested against real temporary repositories.

## UI rules (every change is checked against these)

- Zero border radius. No borders, outlines or shadows on interactive elements. Hover changes color only; focus (`:focus-visible`) has its own background color.
- Lines are allowed only as **state** indicators: the active activity icon, active tab and active panel tab.
- Every scroll region scrolls (`overflow: auto`, `min-width: 0; min-height: 0` on flex children); single-line labels use `ellipsis` plus a `title`.
- Match the VS Code layout and sizes in spec section 11.1 (title bar 35 px, activity bar 48 px, rows 22 px, status bar 22 px …).
- Check the window at its minimum size (960 × 600), with a very long file name, and in Thai.

## Strings

Every visible string goes through `t('key')` (or `tr('key')` outside React). Add the key to the English **and** the Thai file of the feature (`en.team.json` / `th.team.json`, …). `tests/i18n.test.ts` fails when keys or `{placeholders}` differ. Do not define the same key in two files.

## Documentation

When you change a button label, a shortcut or a behaviour, update the manual chapter in **both** languages in the same commit. `tests/manual-docs.test.ts` fails when a documented shortcut or bold label no longer exists, or when the two languages drift apart. Keep `CHANGELOG.md` current.

## Commits

`type(scope): summary`, for example `feat(team): open pull request from the task tab`, `fix(git): handle repositories with no commits`, `docs: Thai manual`. Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.

## Review checklist

- [ ] `npm run typecheck && npm test` pass
- [ ] New strings exist in EN and TH
- [ ] Manual updated (both languages) if behaviour or labels changed
- [ ] UI rules above hold (zero radius, no outlines, scrolling, ellipsis, minimum window)
- [ ] No token or credential reaches a log, an IPC reply to the renderer, or disk
