import { it, expect } from 'vitest'
import { keyFromEvent } from '../src/shared/keys'

const ev = (code: string, m: Partial<{ ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }> = {}) =>
  ({ code, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...m })

it('uses physical key so Thai layout works', () => {
  expect(keyFromEvent(ev('KeyP', { ctrlKey: true }))).toBe('Ctrl+P')
})
it('orders modifiers Ctrl, Shift, Alt', () => {
  expect(keyFromEvent(ev('KeyP', { ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+P')
  expect(keyFromEvent(ev('KeyB', { ctrlKey: true, altKey: true }))).toBe('Ctrl+Alt+B')
})
it('maps punctuation and function keys', () => {
  expect(keyFromEvent(ev('Backquote', { ctrlKey: true }))).toBe('Ctrl+`')
  expect(keyFromEvent(ev('Comma', { ctrlKey: true }))).toBe('Ctrl+,')
  expect(keyFromEvent(ev('F1'))).toBe('F1')
  expect(keyFromEvent(ev('Tab', { ctrlKey: true }))).toBe('Ctrl+Tab')
})
it('plain typing is never a shortcut', () => {
  expect(keyFromEvent(ev('KeyA'))).toBeNull()
  expect(keyFromEvent(ev('KeyA', { shiftKey: true }))).toBeNull()
  expect(keyFromEvent(ev('ControlLeft', { ctrlKey: true }))).toBeNull()
})
