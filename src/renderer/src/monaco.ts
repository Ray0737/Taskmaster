import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { THEMES, THEME_IDS } from './theme/themes'
import { extOf } from '@shared/paths'

self.MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'json') return new jsonWorker()
    if (['css', 'scss', 'less'].includes(label)) return new cssWorker()
    if (['html', 'handlebars', 'razor'].includes(label)) return new htmlWorker()
    if (['typescript', 'javascript'].includes(label)) return new tsWorker()
    return new editorWorker()
  }
}

loader.config({ monaco }) // no CDN: works offline

const hex = (c: string) => c.replace('#', '')

for (const id of THEME_IDS) {
  const t = THEMES[id], u = t.ui, s = t.syntax
  monaco.editor.defineTheme(`tm-${id}`, {
    base: t.dark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: hex(s.comment), fontStyle: 'italic' },
      { token: 'keyword', foreground: hex(s.keyword), fontStyle: s.boldKeywords ? 'bold' : '' },
      { token: 'string', foreground: hex(s.string) },
      { token: 'number', foreground: hex(s.number) },
      { token: 'constant', foreground: hex(s.number) },
      { token: 'type', foreground: hex(s.type), fontStyle: s.italicTypes ? 'italic' : '' },
      { token: 'identifier', foreground: hex(s.variable) },
      { token: 'function', foreground: hex(s.fn) },
      { token: 'delimiter', foreground: hex(s.operator) },
      { token: 'operator', foreground: hex(s.operator) },
      { token: 'tag', foreground: hex(s.tag) },
      { token: 'attribute.name', foreground: hex(s.attribute) },
      { token: 'attribute.value', foreground: hex(s.string) },
      { token: 'string.key.json', foreground: hex(s.attribute) },
      { token: 'string.value.json', foreground: hex(s.string) }
    ],
    colors: {
      'editor.background': u['bg-0'],
      'editor.foreground': u.fg,
      'editorLineNumber.foreground': u['fg-faint'],
      'editorLineNumber.activeForeground': u.fg,
      'editor.lineHighlightBackground': u.hover,
      'editor.lineHighlightBorder': u.hover,
      'editor.selectionBackground': u.focus,
      'editor.inactiveSelectionBackground': u.selected,
      'editorCursor.foreground': u.accent,
      'editorIndentGuide.background1': u.hover,
      'editorIndentGuide.activeBackground1': u.focus,
      'editorWidget.background': u['bg-2'],
      'editorSuggestWidget.background': u['bg-2'],
      'editorSuggestWidget.selectedBackground': u.selected,
      'editorHoverWidget.background': u['bg-2'],
      'minimap.background': u['bg-0'],
      'scrollbarSlider.background': u.scroll,
      'scrollbarSlider.hoverBackground': u['scroll-hover'],
      'scrollbarSlider.activeBackground': u['scroll-hover'],
      'diffEditor.insertedTextBackground': u['diff-add'],
      'diffEditor.removedTextBackground': u['diff-del'],
      'diffEditor.insertedLineBackground': u['diff-add'],
      'diffEditor.removedLineBackground': u['diff-del'],
      'focusBorder': '#00000000',
      'widget.shadow': '#00000000'
    }
  })
}

// Extensions Monaco does not know: Arduino sketches are C++, .NET and Visual Studio project files are XML.
monaco.languages.register({ id: 'cpp', extensions: ['.ino', '.pde'] })
monaco.languages.register({ id: 'xml', extensions: ['.csproj', '.vcxproj', '.props', '.targets', '.xaml', '.resx'] })

// JS, JSX, TS and TSX: JSX understood, completions inside the file. Semantic errors are off on purpose: the editor has no node_modules
// types, so every import would be flagged. Syntax errors stay on. (ponytail: a real language server per language would replace this.)
const ts = monaco.languages.typescript
const tsOptions = {
  target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.NodeJs,
  jsx: ts.JsxEmit.ReactJSX, allowJs: true, allowNonTsExtensions: true, esModuleInterop: true, allowSyntheticDefaultImports: true
}
for (const d of [ts.typescriptDefaults, ts.javascriptDefaults]) {
  d.setCompilerOptions(tsOptions)
  d.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false })
}

export { monaco }
export const uriOf = (path: string) => monaco.Uri.file(path)
export const getModel = (path: string) => monaco.editor.getModel(uriOf(path))
export const disposeModel = (path: string) => getModel(path)?.dispose()

export function languageOf(path: string): string {
  const ext = '.' + extOf(path)
  return monaco.languages.getLanguages().find((l) => l.extensions?.includes(ext))?.id ?? 'plaintext'
}

// Runs the editor's own formatter for this file (Monaco ships one for JS, TS, JSON, CSS and HTML). False when the language has none.
export async function formatPath(path: string): Promise<boolean> {
  const uri = uriOf(path).toString()
  const ed = monaco.editor.getEditors().find((x) => x.getModel()?.uri.toString() === uri)
  const action = ed?.getAction('editor.action.formatDocument')
  if (!ed || !action || !action.isSupported()) return false
  ed.focus() // the palette had focus; the formatter works on the focused editor
  await new Promise((r) => setTimeout(r, 50))
  await action.run()
  return true
}

export const EDITOR_FONT = '"Cascadia Code", Consolas, "Courier New", monospace'
