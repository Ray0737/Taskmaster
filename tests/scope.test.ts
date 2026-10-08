import { it, expect } from 'vitest'
import { writtenPath, outsideScope, toRel } from '../src/shared/scope'

const root = 'C:\\proj'

it('writtenPath returns a project-relative path for write tools', () => {
  expect(writtenPath({ name: 'Edit', input: { file_path: 'C:\\proj\\src\\ui\\A.tsx' } }, root)).toBe('src/ui/A.tsx')
  expect(writtenPath({ name: 'Write', input: { file_path: 'c:\\PROJ\\README.md' } }, root)).toBe('README.md')
  expect(writtenPath({ name: 'NotebookEdit', input: { notebook_path: 'C:\\proj\\a.ipynb' } }, root)).toBe('a.ipynb')
})
it('writtenPath ignores read-only tools and keeps outside paths as-is', () => {
  expect(writtenPath({ name: 'Read', input: { file_path: 'C:\\proj\\a.ts' } }, root)).toBeNull()
  expect(writtenPath({ name: 'Bash', input: { command: 'ls' } }, root)).toBeNull()
  expect(writtenPath({ name: 'Edit', input: { file_path: 'C:\\other\\x.ts' } }, root)).toBe('C:/other/x.ts')
  expect(writtenPath({ name: 'Edit', input: { file_path: 'C:\\proj2\\x.ts' } }, root)).toBe('C:/proj2/x.ts') // sibling, not inside
})
it('toRel', () => {
  expect(toRel('C:\\proj\\src\\a.ts', 'C:\\proj\\')).toBe('src/a.ts')
  expect(toRel('D:\\x\\a.ts', 'C:\\proj')).toBe('D:/x/a.ts')
})
it('outsideScope', () => {
  expect(outsideScope([], 'anything.ts')).toBe(false)
  expect(outsideScope(['src/ui/**'], 'src/ui/deep/A.tsx')).toBe(false)
  expect(outsideScope(['src/ui/**'], 'src/db/x.ts')).toBe(true)
  expect(outsideScope(['src/ui/**', '*.md'], 'README.md')).toBe(false)
  expect(outsideScope(['src/**'], 'C:/other/x.ts')).toBe(true)
  expect(outsideScope(['.github/**'], '.github/workflows/ci.yml')).toBe(false) // dotfiles match
})
