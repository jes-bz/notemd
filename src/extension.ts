import * as vscode from 'vscode'
import * as NodePath from 'path'

const VDITOR_OPTIONS_KEY = 'vditor.options'

function showError(msg: string) {
  vscode.window.showErrorMessage(`[notemd] ${msg}`)
}

function getDriveFolders(): vscode.Uri[] {
  const folders = []
  for (let i = 65; i <= 90; i++) {
    folders.push(vscode.Uri.file(`${String.fromCharCode(i)}:/`))
  }
  return folders
}

function getWebviewRoots(): vscode.WebviewOptions & vscode.WebviewPanelOptions {
  return {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.file('/'), ...getDriveFolders()],
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<base href="${baseHref}" />
<link href="${mainCss}" rel="stylesheet">
<title>notemd</title>
<style>${customCss}</style>
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
) {
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

async function handleUploadMessage(
  files: any[],
  uri: vscode.Uri,
  fsPath: string,
  webview: vscode.Webview
) {
  const assetsFolder = getAssetsFolder(uri)
  try {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(assetsFolder))
  } catch (error) {
    console.error(error)
    showError(`Invalid image folder: ${assetsFolder}`)
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
  const relativePaths = files.map((f: any) =>
    NodePath.relative(
      NodePath.dirname(fsPath),
      NodePath.join(assetsFolder, f.name)
    ).replace(/\\/g, '/')
  )
  webview.postMessage({ command: 'uploaded', files: relativePaths })
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'notemd.openEditor',
      (uri?: vscode.Uri) => {
        EditorPanel.createOrShow(context, uri)
      }
    )
  )

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      NotemdProvider.viewType,
      new NotemdProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  )

  context.globalState.setKeysForSync([VDITOR_OPTIONS_KEY])
}

class EditorPanel {
  public static currentPanel: EditorPanel | undefined
  public static readonly viewType = 'notemd'
  private disposables: vscode.Disposable[] = []
  private isEdit = false

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

  private get fsPath() {
    return this.uri.fsPath
  }

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly panel: vscode.WebviewPanel,
    public document: vscode.TextDocument,
    public uri = document.uri
  ) {
    this.panel.webview.html = buildWebviewHtml(
      panel.webview,
      context.extensionUri,
      this.fsPath,
      vscode.workspace.getConfiguration('notemd').get<string>('customCss') || ''
    )
    this.panel.title = NodePath.basename(this.fsPath)

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables)

    let textEditTimer: ReturnType<typeof setTimeout> | void
    vscode.workspace.onDidCloseTextDocument((e) => {
      if (e.fileName === this.fsPath) this.dispose()
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
      if (this.panel.active) return
      textEditTimer && clearTimeout(textEditTimer)
      textEditTimer = setTimeout(() => {
        this.postMessage()
        this.updateEditTitle()
      }, 300)
    }, this.disposables)

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'ready':
            this.postMessage({
              type: 'init',
              options: getInitOptions(this.context),
              theme: getTheme(),
            })
            break
          case 'save-options':
            this.context.globalState.update(VDITOR_OPTIONS_KEY, message.options)
            break
          case 'info':
            vscode.window.showInformationMessage(message.content)
            break
          case 'error':
            showError(message.content)
            break
          case 'edit':
            if (this.panel.active) {
              await syncToEditor(this.document, this.uri, message.content)
              this.updateEditTitle()
            }
            break
          case 'reset-config':
            await this.context.globalState.update(VDITOR_OPTIONS_KEY, {})
            break
          case 'save':
            await syncToEditor(this.document, this.uri, message.content)
            await this.document.save()
            this.updateEditTitle()
            break
          case 'upload':
            await handleUploadMessage(
              message.files,
              this.uri,
              this.fsPath,
              this.panel.webview
            )
            break
          case 'open-link': {
            let url = message.href
            if (!/^http/.test(url)) {
              url = NodePath.resolve(this.fsPath, '..', url)
            }
            vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url))
            break
          }
        }
      },
      null,
      this.disposables
    )
  }

  private updateEditTitle() {
    const isEdit = this.document.isDirty
    if (isEdit !== this.isEdit) {
      this.isEdit = isEdit
      this.panel.title = `${isEdit ? '[edit]' : ''}${NodePath.basename(this.fsPath)}`
    }
  }

  private async postMessage(
    props: {
      type?: 'init' | 'update'
      options?: any
      theme?: 'dark' | 'light'
    } = {}
  ) {
    const content = this.document
      ? this.document.getText()
      : (await vscode.workspace.fs.readFile(this.uri)).toString()
    this.panel.webview.postMessage({ command: 'update', content, ...props })
  }

  public dispose() {
    EditorPanel.currentPanel = undefined
    this.panel.dispose()
    while (this.disposables.length) {
      const d = this.disposables.pop()
      if (d) d.dispose()
    }
  }
}

class NotemdProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'notemd.customEditor'

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const uri = document.uri
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
      if (webviewPanel.active) return
      updateWebview()
      updateEditTitle()
    }, null, disposables)

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'ready':
          webviewPanel.webview.postMessage({
            command: 'update',
            type: 'init',
            content: document.getText(),
            options: getInitOptions(this.context),
            theme: getTheme(),
          })
          break
        case 'save-options':
          this.context.globalState.update(VDITOR_OPTIONS_KEY, message.options)
          break
        case 'info':
          vscode.window.showInformationMessage(message.content)
          break
        case 'error':
          showError(message.content)
          break
        case 'edit':
          if (webviewPanel.active) {
            await syncToEditor(document, uri, message.content)
            updateEditTitle()
          }
          break
        case 'reset-config':
          await this.context.globalState.update(VDITOR_OPTIONS_KEY, {})
          break
        case 'save':
          await syncToEditor(document, uri, message.content)
          await document.save()
          updateEditTitle()
          break
        case 'upload':
          await handleUploadMessage(
            message.files,
            uri,
            uri.fsPath,
            webviewPanel.webview
          )
          break
        case 'open-link': {
          let url = message.href
          if (!/^http/.test(url)) {
            url = NodePath.resolve(uri.fsPath, '..', url)
          }
          vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url))
          break
        }
      }
    }, null, disposables)

    webviewPanel.onDidDispose(() => {
      disposables.forEach((d) => d.dispose())
    })
  }
}
