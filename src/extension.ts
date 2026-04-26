import * as vscode from 'vscode'
import * as NodePath from 'path'
import { diffLines } from 'diff'
import { getOcrConfig, ocrImageFile, getImageMime, escapeAlt, resolveLocalImage, OcrConfig } from './ocr'

const VDITOR_OPTIONS_KEY = 'vditor.options'

const output = vscode.window.createOutputChannel('notemd')

function formatDate(date: Date, fmt: string): string {
  const tokens: Record<string, string> = {
    yyyy: String(date.getFullYear()),
    yy: String(date.getFullYear()).slice(-2),
    MM: String(date.getMonth() + 1).padStart(2, '0'),
    MMMM: date.toLocaleString('en', { month: 'long' }),
    MMM: date.toLocaleString('en', { month: 'short' }),
    dd: String(date.getDate()).padStart(2, '0'),
    HH: String(date.getHours()).padStart(2, '0'),
    mm: String(date.getMinutes()).padStart(2, '0'),
    ss: String(date.getSeconds()).padStart(2, '0'),
  }
  let result = fmt
  for (const key of Object.keys(tokens).sort((a, b) => b.length - a.length)) {
    result = result.replace(key, tokens[key])
  }
  return result
}

function showError(msg: string): void {
  vscode.window.showErrorMessage(`[notemd] ${msg}`)
}

interface DiffChange {
  startLine: number
  endLine: number
  type: 'added' | 'removed' | 'modified'
}

const MAX_DIFF_CONTENT_SIZE = 1_000_000

async function getHeadContent(fsPath: string): Promise<string | null> {
  try {
    const gitExtension = vscode.extensions.getExtension('vscode.git')
    const ext = gitExtension?.isActive
      ? gitExtension.exports
      : gitExtension ? await gitExtension.activate() : undefined
    const git = ext?.getAPI(1)
    const repo = git?.repositories?.find((r: any) =>
      fsPath.startsWith(r.rootUri.fsPath + NodePath.sep) ||
      fsPath.startsWith(r.rootUri.fsPath)
    )

    if (!gitExtension || !ext || !git || !repo) return null

    const relativePath = NodePath.relative(repo.rootUri.fsPath, fsPath)
    const content = await repo.show('HEAD', relativePath)
    if (typeof content === 'string' && content.length > 0) return content
    return null
  } catch {
    return null
  }
}

function computeDiffChanges(headContent: string, currentContent: string): DiffChange[] {
  const changes: DiffChange[] = []
  const diffResult = diffLines(headContent, currentContent)
  let currentLine = 0

  for (const part of diffResult) {
    const lineCount = part.value.split('\n').length - 1

    if (part.added) {
      changes.push({ startLine: currentLine, endLine: currentLine + lineCount, type: 'added' })
      currentLine += lineCount
    } else if (part.removed) {
      if (currentLine > 0) {
        changes.push({ startLine: currentLine - 1, endLine: currentLine, type: 'modified' })
      } else if (diffResult.length > 1) {
        changes.push({ startLine: 0, endLine: 1, type: 'modified' })
      }
    } else {
      currentLine += lineCount
    }
  }

  return changes
}

async function computeDiffInfo(fsPath: string, currentContent: string): Promise<DiffChange[]> {
  if (currentContent.length > MAX_DIFF_CONTENT_SIZE) return []
  const headContent = await getHeadContent(fsPath)
  if (headContent === null) return []
  return computeDiffChanges(headContent, currentContent)
}

function createDiffScheduler(webview: vscode.Webview, fsPath: string) {
  let diffTimer: ReturnType<typeof setTimeout> | undefined
  let lastDiffContent: string | undefined

  return (content: string) => {
    clearTimeout(diffTimer)
    diffTimer = setTimeout(async () => {
      if (content === lastDiffContent) return
      lastDiffContent = content
      try {
        const changes = await computeDiffInfo(fsPath, content)
        webview.postMessage({ command: 'diff-info', changes })
      } catch {
        // diff computation failed
      }
    }, 300)
  }
}

function getWebviewRoots(): vscode.WebviewOptions & vscode.WebviewPanelOptions {
  return {
    enableScripts: true,
    localResourceRoots: [
      vscode.Uri.file('/'),
      ...Array.from({ length: 26 }, (_, i) =>
        vscode.Uri.file(`${String.fromCharCode(65 + i)}:/`)
      ),
    ],
    retainContextWhenHidden: true,
    enableCommandUris: true,
  }
}

function buildWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  fsPath: string,
  customCss: string
): string {
  const toUri = (f: string) =>
    webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, f))
  const baseHref =
    NodePath.dirname(webview.asWebviewUri(vscode.Uri.file(fsPath)).toString()) + '/'
  const mainJs = toUri('media/dist/main.js')
  const mainCss = toUri('media/dist/main.css')
  const luteJs = toUri('media/dist/lute.min.js')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<base href="${baseHref}" />
<link href="${mainCss}" rel="stylesheet">
<title>notemd</title>
<style>${customCss}</style>
<script>window.__notemd_lute_path="${luteJs}"</script>
</head>
<body>
<div id="app"></div>
<script src="${mainJs}"></script>
</body>
</html>`
}

function getTheme(): 'dark' | 'light' {
  return vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark
    ? 'dark'
    : 'light'
}

function getInitOptions(context: vscode.ExtensionContext) {
  const stored = context.globalState.get(VDITOR_OPTIONS_KEY) || {}
  return {
    useVscodeThemeColor: vscode.workspace
      .getConfiguration('notemd')
      .get<boolean>('useVscodeThemeColor'),
    ...stored,
  }
}

async function syncToEditor(
  document: vscode.TextDocument | undefined,
  uri: vscode.Uri,
  content: string
): Promise<void> {
  if (document) {
    const edit = new vscode.WorkspaceEdit()
    edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), content)
    await vscode.workspace.applyEdit(edit)
  } else {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content))
  }
}

function getAssetsFolder(uri: vscode.Uri): string {
  const config = vscode.workspace.getConfiguration('notemd')
  const imageSaveFolder = (config.get<string>('imageSaveFolder') || 'assets')
    .replace('${projectRoot}', vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath || '')
    .replace('${file}', uri.fsPath)
    .replace('${fileBasenameNoExtension}', NodePath.basename(uri.fsPath, NodePath.extname(uri.fsPath)))
    .replace('${dir}', NodePath.dirname(uri.fsPath))
  return NodePath.resolve(NodePath.dirname(uri.fsPath), imageSaveFolder)
}

// Escape relPath for use in a regex literal
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function ocrAndPatchUpload(
  document: vscode.TextDocument,
  absPath: string,
  relPath: string,
  cfg: OcrConfig,
  webview: vscode.Webview,
  setLastWebviewContent: (s: string) => void
): Promise<void> {
  // Pattern matches only empty-alt references to this exact path.
  // Re-evaluated after OCR so position is always fresh regardless of user edits.
  const emptyAltRe = new RegExp(`!\\[\\]\\(${escapeRegex(relPath)}\\)`)

  const deadline = Date.now() + 15000
  while (Date.now() < deadline && !emptyAltRe.test(document.getText())) {
    await new Promise((r) => setTimeout(r, 250))
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `notemd: OCR ${NodePath.basename(absPath)}`,
    },
    async () => {
      let alt = ''
      try {
        alt = await ocrImageFile(absPath, cfg)
      } catch (err: any) {
        console.error(err)
        showError(`OCR failed for ${NodePath.basename(absPath)}: ${err?.message || err}`)
        return
      }
      if (!alt) return
      const escaped = escapeAlt(alt)

      // Re-read doc fresh after OCR — user may have moved/edited content above
      const text = document.getText()
      const match = emptyAltRe.exec(text)
      if (!match) return  // user manually filled alt or deleted the image — skip

      // Build replacement: insert alt into the empty brackets
      const matchStart = match.index
      const altInsertPos = matchStart + 2  // right after ![
      const newText = text.slice(0, altInsertPos) + escaped + text.slice(altInsertPos)

      // Set before applyEdit so onDidChangeTextDocument skips full webview re-render.
      // These two lines are synchronous — no user edit can slip between them.
      setLastWebviewContent(newText)
      const edit = new vscode.WorkspaceEdit()
      edit.insert(document.uri, document.positionAt(altInsertPos), escaped)
      await vscode.workspace.applyEdit(edit)

      // Patch Vditor in-place — avoids setValue() re-render interrupting user typing
      webview.postMessage({ command: 'patch-alt', path: relPath, alt: escaped })
    }
  )
}

async function handleUploadMessage(
  files: any[],
  uri: vscode.Uri,
  fsPath: string,
  webview: vscode.Webview,
  document: vscode.TextDocument,
  setLastWebviewContent: (s: string) => void,
  context: vscode.ExtensionContext
): Promise<void> {
  const assetsFolder = getAssetsFolder(uri)
  try {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(assetsFolder))
  } catch (error) {
    console.error(error)
    showError(`Invalid image folder: ${assetsFolder}`)
    return
  }
  await Promise.all(
    files.map(async (f: any) => {
      const content = Buffer.from(f.base64, 'base64')
      return vscode.workspace.fs.writeFile(
        vscode.Uri.file(NodePath.join(assetsFolder, f.name)),
        content
      )
    })
  )
  const entries = files.map((f: any) => {
    const absPath = NodePath.join(assetsFolder, f.name)
    const relPath = NodePath.relative(
      NodePath.dirname(fsPath),
      absPath
    ).replace(/\\/g, '/')
    return { absPath, relPath, name: f.name }
  })
  webview.postMessage({
    command: 'uploaded',
    files: entries.map((e) => ({ path: e.relPath })),
  })
  const cfg = await getOcrConfig(context)
  if (!cfg.apiKey) return
  for (const e of entries) {
    if (!getImageMime(e.absPath)) continue
    void ocrAndPatchUpload(document, e.absPath, e.relPath, cfg, webview, setLastWebviewContent)
  }
}

interface ImageRef {
  alt: string
  href: string
  altStart: number
  altEnd: number
}

function findImageRefs(text: string): ImageRef[] {
  const refs: ImageRef[] = []
  const re = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const altStart = m.index + 2
    const altEnd = altStart + m[1].length
    refs.push({ alt: m[1], href: m[2], altStart, altEnd })
  }
  return refs
}

async function ocrDocument(
  document: vscode.TextDocument,
  context: vscode.ExtensionContext,
  options?: { overwrite?: boolean; progress?: vscode.Progress<{ message?: string; increment?: number }> }
): Promise<number> {
  if (!/\.(md|markdown)$/i.test(document.fileName)) return 0
  const cfg = await getOcrConfig(context)
  if (!cfg.apiKey) {
    showError('notemd.ocr.apiKey not configured (use "Notemd: Set OCR API Key" command)')
    return 0
  }
  const text = document.getText()
  const refs = findImageRefs(text)
  const targets = refs.filter((r) => options?.overwrite || !r.alt)
  const locals: { ref: ImageRef; abs: string }[] = []
  for (const r of targets) {
    const abs = await resolveLocalImage(document.uri.fsPath, r.href)
    if (abs) locals.push({ ref: r, abs })
  }
  if (locals.length === 0) return 0

  const results: { ref: ImageRef; alt: string }[] = []
  for (let i = 0; i < locals.length; i++) {
    const { ref, abs } = locals[i]
    options?.progress?.report({ message: `${NodePath.basename(abs)} (${i + 1}/${locals.length})` })
    try {
      const alt = await ocrImageFile(abs, cfg)
      results.push({ ref, alt })
    } catch (err: any) {
      console.error(err)
      showError(`OCR failed for ${NodePath.basename(abs)}: ${err?.message || err}`)
      results.push({ ref, alt: '' })
    }
  }

  const edit = new vscode.WorkspaceEdit()
  for (const { ref, alt } of results) {
    const start = document.positionAt(ref.altStart)
    const end = document.positionAt(ref.altEnd)
    edit.replace(document.uri, new vscode.Range(start, end), escapeAlt(alt))
  }
  await vscode.workspace.applyEdit(edit)
  await document.save()
  return results.length
}

function createMessageHandler(deps: {
  context: vscode.ExtensionContext
  document: vscode.TextDocument
  uri: vscode.Uri
  fsPath: string
  webview: vscode.Webview
  postInit: (msg: any) => void
  onEdit: (content: string) => Promise<void>
  onSaveDone: () => void
  setLastWebviewContent: (s: string) => void
}) {
  return async (message: any) => {
    switch (message.command) {
      case 'ready':
        deps.postInit({
          type: 'init',
          options: getInitOptions(deps.context),
          theme: getTheme(),
        })
        break
      case 'save-options':
        deps.context.globalState.update(VDITOR_OPTIONS_KEY, message.options)
        break
      case 'info':
        vscode.window.showInformationMessage(message.content)
        break
      case 'error':
        showError(message.content)
        break
      case 'edit':
        await deps.onEdit(message.content)
        break
      case 'reset-config':
        await deps.context.globalState.update(VDITOR_OPTIONS_KEY, {})
        break
      case 'save':
        await syncToEditor(deps.document, deps.uri, message.content)
        await deps.document.save()
        deps.onSaveDone()
        break
      case 'upload':
        await handleUploadMessage(
          message.files,
          deps.uri,
          deps.fsPath,
          deps.webview,
          deps.document,
          deps.setLastWebviewContent,
          deps.context
        )
        break
      case 'open-link': {
        let url = message.href
        if (!/^http/.test(url)) {
          url = NodePath.resolve(deps.fsPath, '..', url)
        }
        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url))
        break
      }
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  output.appendLine('notemd activating...')
  output.appendLine(`Extension path: ${context.extensionUri.fsPath}`)
  context.subscriptions.push(output)

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'notemd.openEditor',
      (uri?: vscode.Uri) => {
        output.appendLine('Command: notemd.openEditor')
        EditorPanel.createOrShow(context, uri)
      }
    )
  )
  output.appendLine('Registered: notemd.openEditor')

  const activeWebviews = new Map<vscode.WebviewPanel, vscode.TextDocument>()

  context.subscriptions.push(
    vscode.commands.registerCommand('notemd.revealInSource', async () => {
      let webview: vscode.Webview | undefined
      let document: vscode.TextDocument | undefined

      if (EditorPanel.currentPanel) {
        webview = EditorPanel.currentPanel.webview
        document = EditorPanel.currentPanel.document
      }

      if (!webview) {
        for (const [panel, info] of activeWebviews) {
          if (panel.active) {
            webview = panel.webview
            document = info
            break
          }
        }
      }

      if (!webview || !document) return

      const offset = await new Promise<number>((resolve) => {
        const timeout = setTimeout(() => resolve(-1), 1000)
        const disposable = webview.onDidReceiveMessage((msg: any) => {
          if (msg.command === 'cursor-offset') {
            clearTimeout(timeout)
            disposable.dispose()
            resolve(msg.offset)
          }
        })
        webview.postMessage({ command: 'get-cursor-offset' })
      })

      if (offset < 0) return

      const text = document.getText()
      const lines = text.split('\n')
      const lineIndex = text.substring(0, offset).split('\n').length - 1
      const lineLength = lines[lineIndex]?.length ?? 0
      const editor = await vscode.window.showTextDocument(document.uri, {
        preview: false,
        viewColumn: vscode.ViewColumn.Beside,
      })
      const start = new vscode.Position(lineIndex, 0)
      const end = new vscode.Position(lineIndex, lineLength)
      editor.selection = new vscode.Selection(start, end)
      editor.revealRange(
        new vscode.Range(start, end),
        vscode.TextEditorRevealType.InCenter
      )
    })
  )
  output.appendLine('Registered: notemd.revealInSource')

  context.subscriptions.push(
    vscode.commands.registerCommand('notemd.openDailyNote', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders
      if (!workspaceFolders) {
        showError('No workspace folder open')
        return
      }
      const workspaceRoot = workspaceFolders[0].uri.fsPath
      const config = vscode.workspace.getConfiguration('notemd')
      const folder = config.get<string>('dailyNoteFolder') || ''
      const dateFormat = config.get<string>('dailyNoteFormat') || 'yyyy-MM-dd'

      const filename = formatDate(new Date(), dateFormat) + '.md'
      const filePath = NodePath.join(
        folder ? NodePath.resolve(workspaceRoot, folder) : workspaceRoot,
        filename
      )
      const uri = vscode.Uri.file(filePath)

      try {
        await vscode.workspace.fs.stat(uri)
      } catch (error) {
        console.error(error)
        await vscode.workspace.fs.createDirectory(
          vscode.Uri.file(NodePath.dirname(filePath))
        )
        await vscode.workspace.fs.writeFile(uri, Buffer.from(''))
      }

      EditorPanel.createOrShow(context, uri)
    })
  )
  output.appendLine('Registered: notemd.openDailyNote')

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      NotemdProvider.viewType,
      new NotemdProvider(context, activeWebviews),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  )
  output.appendLine('Registered: notemd.customEditor')

  context.subscriptions.push(
    vscode.commands.registerCommand('notemd.reindexOcr', async () => {
      const doc = vscode.window.activeTextEditor?.document
        || [...activeWebviews.values()][0]
        || EditorPanel.currentPanel?.document
      if (!doc) {
        showError('No active markdown document')
        return
      }
      const count = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'notemd: OCR reindex' },
        (progress) => ocrDocument(doc, context, { progress })
      )
      vscode.window.showInformationMessage(`notemd: OCR updated ${count} image(s)`)
    })
  )
  output.appendLine('Registered: notemd.reindexOcr')

  context.subscriptions.push(
    vscode.commands.registerCommand('notemd.reindexOcrAll', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Reindex OCR for all markdown images in workspace? This will overwrite existing alt text.',
        { modal: true },
        'Reindex All'
      )
      if (confirm !== 'Reindex All') return
      const files = await vscode.workspace.findFiles('**/*.{md,markdown}', '**/node_modules/**')
      let total = 0
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'notemd: OCR reindex all', cancellable: true },
        async (progress, token) => {
          for (let i = 0; i < files.length; i++) {
            if (token.isCancellationRequested) break
            progress.report({ message: `${NodePath.basename(files[i].fsPath)} (${i + 1}/${files.length})` })
            const doc = await vscode.workspace.openTextDocument(files[i])
            total += await ocrDocument(doc, context, { overwrite: true, progress })
          }
        }
      )
      vscode.window.showInformationMessage(`notemd: OCR reindexed ${total} image(s) across ${files.length} file(s)`)
    })
  )
  output.appendLine('Registered: notemd.reindexOcrAll')

  context.subscriptions.push(
    vscode.commands.registerCommand('notemd.setOcrApiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Enter API Key for Notemd OCR',
        password: true,
        ignoreFocusOut: true,
      })
      if (key !== undefined) {
        await context.secrets.store('notemd.ocrApiKey', key)
        vscode.window.showInformationMessage('notemd: OCR API Key saved securely.')
      }
    })
  )
  output.appendLine('Registered: notemd.setOcrApiKey')

  context.globalState.setKeysForSync([VDITOR_OPTIONS_KEY])
  output.appendLine('notemd activated successfully')
}

class EditorPanel {
  public static currentPanel: EditorPanel | undefined
  public static readonly viewType = 'notemd'
  private disposables: vscode.Disposable[] = []
  private isEditing = false
  private lastWebviewContent = ''

  public static async createOrShow(
    context: vscode.ExtensionContext,
    uri?: vscode.Uri
  ) {
    const column = vscode.window.activeTextEditor?.viewColumn
    if (EditorPanel.currentPanel && uri !== EditorPanel.currentPanel.uri) {
      EditorPanel.currentPanel.dispose()
    }
    if (EditorPanel.currentPanel) {
      EditorPanel.currentPanel.panel.reveal(column)
      return
    }
    if (!vscode.window.activeTextEditor && !uri) {
      showError(`Did not open markdown file!`)
      return
    }

    let doc: vscode.TextDocument | undefined
    if (uri) {
      doc = await vscode.workspace.openTextDocument(uri)
    } else {
      doc = vscode.window.activeTextEditor?.document
      if (doc && doc.languageId !== 'markdown') {
        showError(`Current file language is not markdown, got ${doc.languageId}`)
        return
      }
    }
    if (!doc) {
      showError(`Cannot find markdown file!`)
      return
    }

    const panel = vscode.window.createWebviewPanel(
      EditorPanel.viewType,
      'notemd',
      column || vscode.ViewColumn.One,
      getWebviewRoots()
    )
    EditorPanel.currentPanel = new EditorPanel(context, panel, doc, uri)
  }

  public get webview(): vscode.Webview {
    return this.panel.webview
  }

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly panel: vscode.WebviewPanel,
    public document: vscode.TextDocument,
    public uri = document.uri
  ) {
    this.panel.webview.html = buildWebviewHtml(
      panel.webview,
      context.extensionUri,
      this.uri.fsPath,
      vscode.workspace.getConfiguration('notemd').get<string>('customCss') || ''
    )
    this.panel.title = NodePath.basename(this.uri.fsPath)

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables)

    const scheduleDiffInfo = createDiffScheduler(this.panel.webview, this.uri.fsPath)

    let textEditTimer: ReturnType<typeof setTimeout> | undefined
    vscode.workspace.onDidCloseTextDocument((e) => {
      if (e.fileName === this.uri.fsPath) this.dispose()
    }, this.disposables)

    vscode.window.onDidChangeActiveColorTheme(() => {
      this.postMessage({
        type: 'init',
        options: getInitOptions(this.context),
        theme: getTheme(),
      })
    }, null, this.disposables)

    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.fileName !== this.document.fileName) return
      if (e.document.getText() === this.lastWebviewContent) return
      scheduleDiffInfo(e.document.getText())
      textEditTimer && clearTimeout(textEditTimer)
      textEditTimer = setTimeout(() => {
        this.postMessage()
        this.updateEditTitle()
      }, 300)
    }, this.disposables)

    this.panel.webview.onDidReceiveMessage(
      createMessageHandler({
        context: this.context,
        document: this.document,
        uri: this.uri,
        fsPath: this.uri.fsPath,
        webview: this.panel.webview,
        postInit: (msg) => {
          this.postMessage(msg)
          scheduleDiffInfo(this.document.getText())
        },
        onEdit: async (content) => {
          if (this.panel.active) {
            this.lastWebviewContent = content
            await syncToEditor(this.document, this.uri, content)
            this.updateEditTitle()
          }
        },
        onSaveDone: () => {
          this.updateEditTitle()
          scheduleDiffInfo(this.document.getText())
        },
        setLastWebviewContent: (s) => { this.lastWebviewContent = s },
      }),
      null,
      this.disposables
    )
  }

  private updateEditTitle() {
    const isDirty = this.document.isDirty
    if (isDirty !== this.isEditing) {
      this.isEditing = isDirty
      this.panel.title = `${isDirty ? '[edit]' : ''}${NodePath.basename(this.uri.fsPath)}`
    }
  }

  private async postMessage(
    props: {
      type?: 'init' | 'update'
      options?: any
      theme?: 'dark' | 'light'
    } = {}
  ): Promise<void> {
    const content = this.document
      ? this.document.getText()
      : (await vscode.workspace.fs.readFile(this.uri)).toString()
    this.panel.webview.postMessage({ command: 'update', content, ...props })
  }

  public dispose() {
    EditorPanel.currentPanel = undefined
    this.panel.dispose()
    this.disposables.forEach((d) => d?.dispose())
    this.disposables = []
  }
}

class NotemdProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'notemd.customEditor'

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly activeWebviews: Map<vscode.WebviewPanel, vscode.TextDocument>
  ) { }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const uri = document.uri
    this.activeWebviews.set(webviewPanel, document)
    webviewPanel.webview.options = getWebviewRoots()
    webviewPanel.webview.html = buildWebviewHtml(
      webviewPanel.webview,
      this.context.extensionUri,
      uri.fsPath,
      vscode.workspace.getConfiguration('notemd').get<string>('customCss') || ''
    )
    webviewPanel.title = NodePath.basename(uri.fsPath)

    const disposables: vscode.Disposable[] = []
    let isEditing = false
    let lastWebviewContent = ''

    const scheduleDiffInfo = createDiffScheduler(webviewPanel.webview, uri.fsPath)

    const updateEditTitle = () => {
      const isDirty = document.isDirty
      if (isDirty !== isEditing) {
        isEditing = isDirty
        webviewPanel.title = `${isDirty ? '[edit]' : ''}${NodePath.basename(uri.fsPath)}`
      }
    }

    const updateWebview = () => {
      webviewPanel.webview.postMessage({
        command: 'update',
        content: document.getText(),
      })
    }

    vscode.workspace.onDidCloseTextDocument((e) => {
      if (e.fileName === uri.fsPath) webviewPanel.dispose()
    }, null, disposables)

    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.fileName !== document.fileName) return
      if (e.document.getText() === lastWebviewContent) return
      scheduleDiffInfo(e.document.getText())
      updateWebview()
      updateEditTitle()
    }, null, disposables)

    webviewPanel.webview.onDidReceiveMessage(
      createMessageHandler({
        context: this.context,
        document,
        uri,
        fsPath: uri.fsPath,
        webview: webviewPanel.webview,
        postInit: (msg) => {
          webviewPanel.webview.postMessage({
            command: 'update',
            content: document.getText(),
            ...msg,
          })
          scheduleDiffInfo(document.getText())
        },
        onEdit: async (content) => {
          if (webviewPanel.active) {
            lastWebviewContent = content
            await syncToEditor(document, uri, content)
            updateEditTitle()
          }
        },
        onSaveDone: () => {
          updateEditTitle()
          scheduleDiffInfo(document.getText())
        },
        setLastWebviewContent: (s) => { lastWebviewContent = s },
      }),
      null,
      disposables
    )

    webviewPanel.onDidDispose(() => {
      this.activeWebviews.delete(webviewPanel)
      disposables.forEach((d) => d.dispose())
    })
  }
}
