import { it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { inside, listDir, readFileContent, walk, IGNORED_RE } from '../src/main/services/fs'

const tmp = () => mkdtempSync(join(tmpdir(), 'tm-fs-'))

it('inside accepts nested paths and rejects escapes', () => {
  const root = tmp()
  expect(inside(root, join(root, 'a', 'b.txt'))).toBe(join(root, 'a', 'b.txt'))
  expect(inside(root, 'a/b.txt')).toBe(join(root, 'a', 'b.txt'))
  expect(() => inside(root, join(root, '..', 'x'))).toThrow('outside')
  expect(() => inside(root, root + '2')).toThrow('outside') // sibling with same prefix
  expect(() => inside(null, 'x')).toThrow('No project')
})

it('listDir hides .git and node_modules, dirs first, natural sort', async () => {
  const root = tmp()
  for (const d of ['.git', 'node_modules', 'src', 'b']) mkdirSync(join(root, d))
  for (const f of ['file10.txt', 'file2.txt', 'A.md']) writeFileSync(join(root, f), 'x')
  const names = (await listDir(root)).map((e) => e.name)
  expect(names).toEqual(['b', 'src', 'A.md', 'file2.txt', 'file10.txt'])
})

it('readFileContent classifies text, binary, missing', async () => {
  const root = tmp()
  writeFileSync(join(root, 't.txt'), 'hello')
  writeFileSync(join(root, 'b.png'), Buffer.from([137, 80, 78, 71, 0, 1, 2]))
  expect(await readFileContent(join(root, 't.txt'))).toEqual({ kind: 'text', text: 'hello', readonly: false })
  expect(await readFileContent(join(root, 'b.png'))).toEqual({ kind: 'binary' })
  expect(await readFileContent(join(root, 'nope.txt'))).toEqual({ kind: 'missing' })
})

it('readFileContent refuses files over 20 MB', async () => {
  const root = tmp()
  writeFileSync(join(root, 'big.log'), Buffer.alloc(21 * 1024 * 1024, 97))
  expect(await readFileContent(join(root, 'big.log'))).toEqual({ kind: 'tooBig' })
})

it('walk lists files with forward slashes and skips ignored dirs', async () => {
  const root = tmp()
  mkdirSync(join(root, 'src', 'ui'), { recursive: true })
  mkdirSync(join(root, 'node_modules', 'x'), { recursive: true })
  writeFileSync(join(root, 'src', 'ui', 'App.tsx'), '')
  writeFileSync(join(root, 'node_modules', 'x', 'i.js'), '')
  writeFileSync(join(root, 'README.md'), '')
  expect(await walk(root)).toEqual(['README.md', 'src/ui/App.tsx'])
  expect(await walk(root, 1)).toHaveLength(1)
})

it('IGNORED_RE matches watcher names', () => {
  expect(IGNORED_RE.test('.git\\index')).toBe(true)
  expect(IGNORED_RE.test('a/node_modules/b')).toBe(true)
  expect(IGNORED_RE.test('src/gitstuff.ts')).toBe(false)
})
