# Notemd

<img src="logo.png" alt="Notemd" width="128">

A markdown note-taking environment with WYSIWYG editing for VS Code.

## Usage

- **Command palette**: `Notemd: Open with Notemd`
- **Keybinding**: `cmd+shift+alt+m` (macOS) / `ctrl+shift+alt+m` (Windows/Linux)
- **Context menu**: Right-click a `.md` file in the editor tab or explorer
- **Default editor**: Right-click a `.md` file → Open With... → Notemd
- **Reveal in Source**: Command palette → `Notemd: Reveal in Source` — opens the plain text editor at the cursor's line. Useful for Claude Code integration (selections in the text editor are visible to other extensions).
- **Daily Notes**: Command palette → `Notemd: Open Today's Daily Note` — opens or creates a note named after today's date. Use `notemd.dailyNoteFolder` to organize into folders, `notemd.dailyNoteFormat` to customize the filename format.

## Settings

### Image Save Folder

Configure where images are saved when pasted or drag-dropped into the editor.


| Template Variable            | Expands To                             |
| ---------------------------- | -------------------------------------- |
| `${projectRoot}`             | Workspace root path                    |
| `${file}`                    | Full path to the markdown file         |
| `${fileBasenameNoExtension}` | Filename without extension             |
| `${dir}`                     | Directory containing the markdown file |

Examples:

- `assets` (default) — saves to `assets/` next to the markdown file
- `${projectRoot}/assets` — saves to `assets/` at the workspace root
- `${dir}/${fileBasenameNoExtension}-images` — saves to a folder named after the file

### Custom CSS

Inject CSS to customize the editor layout. Example in `settings.json`:

```json
"notemd.customCss": ".vditor-ir pre.vditor-reset { line-height: 32px; padding-right: calc(100% - 800px) !important; }"
```

### Daily Notes

Daily notes are created with an empty body. Examples with `dailyNoteFormat`:


| Format                 | Filename                   |
| ---------------------- | -------------------------- |
| `yyyy-MM-dd` (default) | `2026-03-27.md`            |
| `yyyy/MMMM/yyyy-MM-dd` | `2026/March/2026-03-27.md` |
| `yyyy/yyyy-MM-dd`      | `2026/2026-03-27.md`       |

Intermediate folders are created automatically.

## Setup

```sh
git clone https://github.com/jes-bz/notemd.git
cd notemd
npm install
```

## Development

```sh
npm run build      # compile extension + bundle webview
npm run compile    # compile extension only (tsc)
npm run package    # build + generate .vsix for local install
```

The `.vsix` file is generated in the project root. Install it in VS Code via:

1. Open the Extensions sidebar
2. Click `...` → Install from VSIX...
3. Select `notemd-0.0.1.vsix`

## License

MIT
