// "Run file": the terminal line that runs a source file with a toolchain the user already has installed.
// The terminal is PowerShell on Windows (the only build today), so lines use PowerShell syntax. Compiled languages build into
// the temp folder so the project stays clean. Returns null for files that cannot be run this way.
const q = (p: string): string => `'${p.replace(/'/g, "''")}'` // single quotes: PowerShell does not expand $ or backticks inside them

const EXE = '$env:TEMP\\tm-run.exe'

export function runLine(path: string): string | null {
  const ext = (/\.([A-Za-z0-9]+)$/.exec(path)?.[1] ?? '').toLowerCase()
  const f = q(path)
  switch (ext) {
    case 'py': return `python ${f}`
    case 'js': case 'mjs': case 'cjs': return `node ${f}`
    case 'ts': case 'tsx': case 'jsx': return `npx --yes tsx ${f}`
    case 'c': return `gcc ${f} -o ${EXE}; if ($?) { & ${EXE} }`
    case 'cpp': case 'cc': case 'cxx': return `g++ ${f} -o ${EXE}; if ($?) { & ${EXE} }`
    case 'cs': return `dotnet run ${f}`
    case 'java': return `java ${f}`
    case 'go': return `go run ${f}`
    case 'ps1': return `& ${f}`
    default: return null
  }
}
