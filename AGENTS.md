# AGENTS.md — Notemd (VS Code Markdown Editor Extension)

## Project Overview

Notemd is a VS Code extension providing WYSIWYG markdown editing via the [Vditor](https://github.com/Vanessa219/vditor) editor. It has two compilation contexts:

- **Extension host** (`src/extension.ts`) — compiled by `tsc`, runs in Node.js/VSC extension host
- **Webview** (`src/media/*.ts`) — bundled by `esbuild`, runs in the webview iframe

## Build / Package Commands

```bash
npm run build        # Full build: tsc + esbuild webview bundle
npm run compile      # TypeScript only (tsc -p ./)
npm run package      # Build then create .vsix with vsce
```

There is **no watch script** defined in `package.json` (the `.vscode/tasks.json` references `npm run watch` but it does not exist). To iterate during development, run `npm run build` manually or use the VS Code "Run Extension" launch config (F5).

## Testing

There is **no test framework, test runner, or test files** in this project. `@testing-library/user-event` is a devDependency but is only imported in `src/media/fix-table-ir.ts` for simulating keyboard input at runtime — it is not used for automated tests.

## Linting / Formatting

- **No ESLint config or Prettier config** exists in the repo. The `.vscode/extensions.json` recommends the `dbaeumer.vscode-eslint` extension, but no rules are defined.
- **No lint or format scripts** in `package.json`.
- TypeScript strict mode is enabled (`"strict": true` in `tsconfig.json`).

## Code Style

### Indentation
- **Tabs** (configured in `.vscode/settings.json`: `"editor.insertSpaces": false`)

### Semicolons
- **No semicolons** — the entire codebase omits trailing semicolons on statements.

### Imports
- Node built-ins: `import * as NodePath from 'path'`
- VS Code API: `import * as vscode from 'vscode'`
- Named imports from local modules: `import { fixDarkTheme, fixLinkClick } from './utils'`
- Side-effect imports for CSS: `import 'vditor/dist/index.css'`
- `require()` is used only for jquery-confirm (CommonJS-only library): `require('jquery-confirm')(window, $)`

### Types & Typing
- TypeScript strict mode is on. Always provide explicit types for function parameters and return types.
- Use `Record<K, V>` for typed objects, e.g. `const tokens: Record<string, string> = { ... }`
- Use `any` sparingly — message handlers and webview communication use `any` for message payloads (e.g. `message: any`).
- Global type declarations go in `declare global {}` blocks (see `src/media/utils.ts`).
- Module declarations for non-TS assets in `src/media/types.ts`: `declare module '*.css'`, etc.

### Naming Conventions
- **Functions**: `camelCase` — `formatDate`, `getWebviewRoots`, `handleUploadMessage`
- **Classes**: `PascalCase` — `EditorPanel`, `NotemdProvider`
- **Constants**: `UPPER_SNAKE_CASE` — `VDITOR_OPTIONS_KEY`, `BLOCK_TAG_RE`, `TABLE_PANEL_ID`
- **Local variables**: `camelCase` — `inputTimer`, `isDark`, `assetsFolder`
- **Private members**: no underscore prefix, use `private` keyword — `private disposables`, `private isEditing`

### Error Handling
- User-facing errors: `vscode.window.showErrorMessage(...)` via the `showError()` helper which prefixes `[notemd]`
- Internal/runtime errors: `console.error(error)` in catch blocks
- Async operations: use `try/catch` around filesystem and webview operations

### Functions & Patterns
- Exported functions use named `export function` declarations
- Factory functions return objects (e.g. `getWebviewRoots()` returns `vscode.WebviewOptions & vscode.WebviewPanelOptions`)
- Dependency injection via object parameters: `createMessageHandler(deps: { context, document, ... })`
- Disposables tracked in arrays and disposed in `dispose()` methods: `this.disposables.forEach(d => d?.dispose())`
- Template literals for HTML generation in `buildWebviewHtml()`
- Timers use `ReturnType<typeof setTimeout>` for type safety

### Module Structure
- `src/extension.ts` — single file containing all extension host logic (commands, panels, custom editor provider)
- `src/media/` — webview-side code, bundled separately by esbuild
- Keep related utilities in dedicated files (`utils.ts`, `toolbar.ts`, `lang.ts`)

### General Guidelines
- Prefer `const` over `let`; avoid `var`
- Use arrow functions for callbacks and inline expressions
- Use `async/await` over raw Promises
- Message protocol between extension and webview uses `{ command: string, ...payload }` objects
- All webview communication goes through `vscode.postMessage()` and `webview.onDidReceiveMessage()`
