# UI end-to-end scripts

They drive a built Taskmaster through the Chromium DevTools protocol (Node 22+, no extra packages). They create a scratch git project and a local bare remote, so nothing real is touched. Script 01 also sends one short message to Claude Code (a few cents).

```powershell
npm run build:win:local            # builds %LOCALAPPDATA%\Taskmaster\dist\win-unpacked
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue   # must be unset or Electron runs as plain Node
$exe = "$env:LOCALAPPDATA\Taskmaster\dist\win-unpacked\Taskmaster.exe"
$work = "$env:TEMP\tm-e2e"
Start-Process $exe -ArgumentList "--remote-debugging-port=9333","--user-data-dir=$work\profile"
Start-Sleep 6
node scripts/e2e/01-setup-project-team-agent.mjs 9333 "$work\fixture"   # creates the fixture
node scripts/e2e/02-git-help-agent-stop.mjs      9333 "$work\fixture"
node scripts/e2e/03-teammate-sync.mjs            9333 "$work\fixture"
# close the Taskmaster window you started (or stop that one process by its Id)
```

Each line prints PASS or FAIL. Use a short work folder (like `C:\tmf`): git fails with "Filename too long" on very deep paths. Script 08 covers multi-select and bulk actions in the task list and screenshots pasted into a task, ending with one short real agent turn that must read the screenshot. Script 12 covers the Claude Dark theme, rounded panels, syntax highlighting of py, c, cs, tsx, ino and mjs files, Run File (runs a node script in the terminal) and the chat's person icon and cooking indicator (one short real agent turn). Script 11 covers the Markdown preview, the usage icon style and (when the window state can be set) the maximized frame. Script 10 covers the compact composer, usage hidden for other agents, presence and the Notifications tab, with agent proposals (two short real agent turns). Script 09 imports a skill from a public GitHub repo (needs internet) and deletes it again. Scripts 03, 05, 06, 07, 08, 09, 10, 11 and 12 need the fixture from script 01. Script 06 covers the team skills dialog and the "Use team skills in the agent" setting. Script 07 covers the mono-light, mocha and github-dark themes, Thai at the minimum window size (960 x 600, emulated viewport) and Tab focus. Last full run (v1.0.0, installed from the NSIS installer): 01, 02, 03 and 05 all PASS. Run on a fresh `npm run build:win:local` build (before the Thai text fix in the i18n files, which is not rebuilt yet): 01, 02, 03, 05, 06 and 07 all PASS.
