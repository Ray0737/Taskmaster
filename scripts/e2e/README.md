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
Get-Process Taskmaster | Stop-Process
```

Each line prints PASS or FAIL. Two known false FAILs in script 01 (`task shows Doing` is case-sensitive against a CSS-uppercased label, and the help-icon check picks the sidebar icon first); script 02 checks both correctly. The "no claude process left" line in 02 counts every `claude` process on the machine, so compare the before and after numbers, not the zero.
