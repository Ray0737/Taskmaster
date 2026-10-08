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

Each line prints PASS or FAIL. Use a short work folder (like `C:\tmf`): git fails with "Filename too long" on very deep paths. Script 05 (tab switching) needs the fixture from script 01, and so does 03. Last full run (v1.0.0, installed from the NSIS installer): 01, 02, 03 and 05 all PASS.
