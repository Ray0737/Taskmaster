import { it, expect } from 'vitest'
import { runLine } from '../src/shared/run'

it('maps source files to a PowerShell run line and refuses the rest', () => {
  expect(runLine('C:\\p\\a.py')).toBe("python 'C:\\p\\a.py'")
  expect(runLine('C:\\p\\a.mjs')).toBe("node 'C:\\p\\a.mjs'")
  expect(runLine('C:\\p\\App.tsx')).toBe("npx --yes tsx 'C:\\p\\App.tsx'")
  expect(runLine('C:\\p\\m.c')).toContain("gcc 'C:\\p\\m.c' -o $env:TEMP\\tm-run.exe")
  expect(runLine('C:\\p\\m.cpp')).toContain('g++ ')
  expect(runLine('C:\\p\\P.cs')).toBe("dotnet run 'C:\\p\\P.cs'")
  expect(runLine('C:\\p\\sketch.ino')).toBeNull()
  expect(runLine('C:\\p\\README.md')).toBeNull()
  expect(runLine('C:\\p\\noext')).toBeNull()
})

it('quotes paths so PowerShell does not expand them', () => {
  expect(runLine("C:\\my files\\it's $x.py")).toBe("python 'C:\\my files\\it''s $x.py'")
})
