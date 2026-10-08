import { it, expect } from 'vitest'
import { basename, dirname, joinPath, relPath, extOf } from '../src/shared/paths'

it('handles windows paths', () => {
  expect(basename('C:\\proj\\src\\App.tsx')).toBe('App.tsx')
  expect(dirname('C:\\proj\\src\\App.tsx')).toBe('C:\\proj\\src')
  expect(joinPath('C:\\proj', 'src/App.tsx')).toBe('C:\\proj\\src\\App.tsx')
  expect(relPath('C:\\proj', 'C:\\proj\\src\\App.tsx')).toBe('src/App.tsx')
})
it('handles posix paths', () => {
  expect(joinPath('/home/a/', 'b/c.md')).toBe('/home/a/b/c.md')
  expect(basename('/home/a/')).toBe('a')
})
it('extension', () => {
  expect(extOf('a/B.TSX')).toBe('tsx')
  expect(extOf('a/.gitignore')).toBe('')
  expect(extOf('Makefile')).toBe('')
})
