# Notemd

A markdown note-taking environment with WYSIWYG editing for VS Code.

## Usage

- **Command palette**: `Notemd: Open with Notemd`
- **Keybinding**: `cmd+shift+alt+m` (macOS) / `ctrl+shift+alt+m` (Windows/Linux)
- **Context menu**: Right-click a `.md` file in the editor tab or explorer
- **Default editor**: Right-click a `.md` file → Open With... → Notemd

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `notemd.imageSaveFolder` | `assets` | Folder where pasted/uploaded images are saved. Relative to the markdown file by default. Use template variables for custom paths. |
| `notemd.useVscodeThemeColor` | `true` | Sync the editor background color with your VS Code theme. |
| `notemd.customCss` | `""` | Custom CSS injected into the editor webview. |

### Image Save Folder

Configure where images are saved when pasted or drag-dropped into the editor.

| Template Variable | Expands To |
|-------------------|------------|
| `${projectRoot}` | Workspace root path |
| `${file}` | Full path to the markdown file |
| `${fileBasenameNoExtension}` | Filename without extension |
| `${dir}` | Directory containing the markdown file |

Examples:
- `assets` (default) — saves to `assets/` next to the markdown file
- `${projectRoot}/assets` — saves to `assets/` at the workspace root
- `${dir}/${fileBasenameNoExtension}-images` — saves to a folder named after the file

### Custom CSS

Inject CSS to customize the editor layout. Example in `settings.json`:

```json
"notemd.customCss": ".vditor-ir pre.vditor-reset { line-height: 32px; padding-right: calc(100% - 800px) !important; }"
```

## Build

```sh
pnpm install
pnpm build      # compile extension + webview
pnpm package    # build + generate .vsix
```

## License

MIT
