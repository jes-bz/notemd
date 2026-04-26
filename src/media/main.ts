import {
  fileToBase64,
  fixCut,
  fixDarkTheme,
  fixLinkClick,
  fixPanelHover,
  handleToolbarClick,
  saveVditorOptions,
} from './utils'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { lang } from './lang'
import { toolbar } from './toolbar'
import { fixTableIr } from './fix-table-ir'
import './main.css'

const BLOCK_SAMPLE = 25
const BLOCK_TAG_RE = /^(P|H[1-6]|LI|BLOCKQUOTE|PRE|OL|UL|HR|TABLE|DL|DD|DT|FIGURE|DIV)$/
const isBlockEl = (el: Element) => BLOCK_TAG_RE.test(el.tagName)

function initVditor(msg: any): void {
  let inputTimer: ReturnType<typeof setTimeout> | undefined
  const defaultOptions = {
    ...msg.options,
    preview: {
      ...msg.options?.preview,
      math: { inlineDigit: true },
    },
  }

  const isDark = msg.theme === 'dark'
  if (msg.theme) {
    defaultOptions.theme = isDark ? 'dark' : 'classic'
    defaultOptions.preview = defaultOptions.preview || {}
    defaultOptions.preview.theme = { current: isDark ? 'dark' : 'light' }
  }

  if (window.vditor) {
    vditor.destroy()
    window.vditor = null
  }

  const vditorOpts: Record<string, any> = {
    width: '100%',
    height: '100%',
    minHeight: '100%',
    lang,
    value: msg.content,
    mode: 'ir',
    cache: { enable: false },
    toolbar,
    toolbarConfig: { pin: true },
    ...defaultOptions,
  }

  const localLute = (window as any).__notemd_lute_path
  if (localLute) {
    vditorOpts._lutePath = localLute
  }

  vditorOpts.after = function() {
    fixDarkTheme()
    handleToolbarClick()
    fixTableIr()
    fixPanelHover()
    if (pendingDiffChanges) {
      renderDiffMarkers(pendingDiffChanges)
      pendingDiffChanges = null
    }
  }
  vditorOpts.input = function() {
    clearTimeout(inputTimer)
    inputTimer = setTimeout(() => {
      vscode.postMessage({ command: 'edit', content: vditor.getValue() })
    }, 100)
  }
  vditorOpts.upload = {
    url: '/fuzzy',
    async handler(files: File[]) {
      const fileInfos = await Promise.all(
        files.map(async (f) => ({
          base64: await fileToBase64(f),
          name: `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}_${f.name}`.replace(
            /[^\w-_.]+/,
            '_'
          ),
        }))
      )
      vscode.postMessage({
        command: 'upload',
        files: fileInfos,
      })
    },
  }

  window.vditor = new Vditor('app', vditorOpts as any)
}

function getTableOffset(
  tableNode: HTMLElement,
  cellNode: HTMLElement,
  cursorNode: Node,
  cursorOffset: number,
  editor: HTMLElement,
  md: string
): number | null {
  const rows = tableNode.querySelectorAll('tr')
  let targetRow = 0
  let targetCol = 0

  outer: for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const cells = rows[rowIdx].querySelectorAll('td, th')
    for (let colIdx = 0; colIdx < cells.length; colIdx++) {
      if (cells[colIdx] === cellNode) {
        targetRow = rowIdx
        targetCol = colIdx
        break outer
      }
    }
  }

  const allTables = editor.querySelectorAll('table')
  let tableIndex = 0
  for (let tableIdx = 0; tableIdx < allTables.length; tableIdx++) {
    if (allTables[tableIdx] === tableNode) {
      tableIndex = tableIdx
      break
    }
  }

  const mdLines = md.split('\n')
  let tableCount = 0
  let tableStartLine = -1
  for (let lineIdx = 0; lineIdx < mdLines.length; lineIdx++) {
    const isTableRow = mdLines[lineIdx].trim().startsWith('|')
    const prevIsTableRow =
      lineIdx > 0 && mdLines[lineIdx - 1].trim().startsWith('|')
    if (isTableRow && !prevIsTableRow) {
      if (tableCount === tableIndex) {
        tableStartLine = lineIdx
      }
      tableCount++
    }
  }
  if (tableStartLine < 0) return null

  const tableMdRow =
    tableStartLine + targetRow + (targetRow > 0 ? 1 : 0)
  const line = mdLines[tableMdRow]
  if (!line) return null

  let colPos = 0
  let pipeCount = 0
  for (let charIdx = 0; charIdx < line.length; charIdx++) {
    if (line[charIdx] === '|') {
      pipeCount++
      if (pipeCount > targetCol) {
        colPos = charIdx + 1
        break
      }
    }
  }

  let offset = 0
  for (let lineIdx = 0; lineIdx < tableMdRow; lineIdx++) {
    offset += mdLines[lineIdx].length + 1
  }
  offset += colPos
  return offset
}

function getCursorTextOffset(): number {
  const editor = vditor.vditor.ir?.element
  if (!editor) return 0

  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return 0

  const cursorNode = sel.anchorNode
  const cursorOffset = sel.anchorOffset
  if (!cursorNode) return 0

  const md = vditor.getValue()

  let cellNode: HTMLElement | null = null
  let tableNode: HTMLElement | null = null
  let ancestor: Node | null = cursorNode
  while (ancestor && ancestor !== editor) {
    if (ancestor instanceof HTMLElement) {
      if (ancestor.tagName === 'TD' || ancestor.tagName === 'TH')
        cellNode = ancestor
      if (ancestor.tagName === 'TABLE') {
        tableNode = ancestor
        break
      }
    }
    ancestor = ancestor.parentNode
  }

  if (tableNode && cellNode) {
    const tableOffset = getTableOffset(
      tableNode,
      cellNode,
      cursorNode,
      cursorOffset,
      editor,
      md
    )
    if (tableOffset !== null) return tableOffset
  }

  let block: HTMLElement | null = null
  let node: Node | null = cursorNode
  while (node && node !== editor) {
    if (node instanceof HTMLElement && isBlockEl(node)) {
      block = node
      break
    }
    node = node.parentNode
  }
  if (!block) return 0

  const blockText = block.textContent?.trim() || ''
  const sample = blockText.substring(0, BLOCK_SAMPLE)
  if (!sample) return 0

  const matchIdx = md.indexOf(sample)
  if (matchIdx < 0) return 0

  const blockRange = document.createRange()
  blockRange.selectNodeContents(block)
  blockRange.setEnd(cursorNode, cursorOffset)
  const domOffsetInBlock = blockRange.toString().length

  const domBlockLen = block.textContent?.length || 1
  const ratio = domOffsetInBlock / domBlockLen
  return (
    matchIdx +
    Math.round(ratio * Math.min(blockText.length, md.length - matchIdx))
  )
}

interface DiffChange {
  startLine: number
  endLine: number
  type: 'added' | 'removed' | 'modified'
}

let pendingDiffChanges: DiffChange[] | null = null

function clearDiffMarkers(): void {
  document.querySelectorAll('.notemd-diff-marker').forEach((el) => el.remove())
}

function findEditorElement(): HTMLElement | null {
  if (window.vditor?.vditor) {
    const mode = vditor.vditor.currentMode || 'ir'
    const modeEl = vditor.vditor[mode]?.element as HTMLElement | undefined
    if (modeEl && (modeEl.children.length > 0 || modeEl.textContent)) return modeEl
  }

  const candidates = document.querySelectorAll('[contenteditable="true"]')
  for (const el of Array.from(candidates)) {
    if (el instanceof HTMLElement && el.children.length > 0) return el
  }

  return null
}

function renderDiffMarkers(changes: DiffChange[]): void {
  clearDiffMarkers()
  if (changes.length === 0) return

  const editor = findEditorElement()
  if (!editor || editor.children.length === 0) {
    pendingDiffChanges = changes
    return
  }

  const md = window.vditor ? vditor.getValue() : (editor.textContent || '')
  const blocks: HTMLElement[] = []

  for (const child of Array.from(editor.children)) {
    if (child instanceof HTMLElement) {
      if (child.classList.contains('notemd-diff-marker')) continue
      if (isBlockEl(child)) blocks.push(child)
    }
  }

  if (blocks.length === 0) {
    pendingDiffChanges = changes
    return
  }

  const DIFF_PRIORITY: Record<string, number> = { removed: 3, modified: 2, added: 1 }
  let currentLine = 0

  for (const block of blocks) {
    const blockText = (block.textContent || '').trim()
    if (!blockText) {
      currentLine++
      continue
    }

    const sample = blockText.substring(0, BLOCK_SAMPLE)
    const matchIdx = md.indexOf(sample)

    let blockStartLine = currentLine
    let blockLineCount = 1

    if (matchIdx >= 0) {
      blockStartLine = md.substring(0, matchIdx).split('\n').length - 1
      const blockEndIdx = matchIdx + blockText.length
      const nextNewline = md.indexOf('\n', blockEndIdx)
      const endIdx = nextNewline >= 0 ? nextNewline : md.length
      blockLineCount = md.substring(0, endIdx).split('\n').length - blockStartLine
      currentLine = blockStartLine + blockLineCount
    } else {
      currentLine++
    }

    let bestType: string | null = null
    let bestPriority = -1

    for (const change of changes) {
      if (change.startLine >= blockStartLine + blockLineCount) continue
      if (change.endLine <= blockStartLine) continue

      const priority = DIFF_PRIORITY[change.type] ?? 0
      if (priority > bestPriority) {
        bestPriority = priority
        bestType = change.type
      }
    }

    if (bestType) {
      const marker = document.createElement('div')
      marker.className = `notemd-diff-marker notemd-diff-${bestType}`
      marker.style.top = block.offsetTop + 'px'
      marker.style.height = block.offsetHeight + 'px'
      editor.appendChild(marker)
    }
  }
}

window.addEventListener('message', (e) => {
  const msg = e.data
  switch (msg.command) {
    case 'update': {
      if (msg.type === 'init') {
        clearDiffMarkers()
        pendingDiffChanges = null
        document.body.setAttribute(
          'data-use-vscode-theme-color',
          msg.options?.useVscodeThemeColor ? '1' : '0'
        )
        try {
          initVditor(msg)
        } catch (error) {
          console.error(error)
          initVditor({ content: msg.content })
          saveVditorOptions()
        }
      } else {
        vditor.setValue(msg.content)
      }
      break
    }
    case 'patch-alt': {
      const current = vditor.getValue()
      const target = `![](${msg.path})`
      if (current.includes(target)) {
        vditor.setValue(current.replace(target, `![${msg.alt}](${msg.path})`))
      }
      break
    }
    case 'uploaded': {
      msg.files.forEach((entry: string | { path: string }) => {
        const f = typeof entry === 'string' ? entry : entry.path
        if (f.endsWith('.wav')) {
          vditor.insertValue(
            `\n\n<audio controls="controls" src="${f}"></audio>\n\n`
          )
        } else {
          const i = new Image()
          i.src = f
          i.onload = () => {
            vditor.insertValue(`\n\n![](${f})\n\n`)
          }
          i.onerror = () => {
            vditor.insertValue(`\n\n[${f.split('/').slice(-1)[0]}](${f})\n\n`)
          }
        }
      })
      break
    }
    case 'get-cursor-offset': {
      vscode.postMessage({
        command: 'cursor-offset',
        offset: getCursorTextOffset(),
      })
      break
    }
    case 'diff-info': {
      renderDiffMarkers(msg.changes || [])
      break
    }
  }
})

fixLinkClick()
fixCut()

const diffObserver = new MutationObserver(() => {
  if (pendingDiffChanges && findEditorElement()?.children?.length) {
    renderDiffMarkers(pendingDiffChanges)
    pendingDiffChanges = null
  }
})
diffObserver.observe(document.body, { childList: true, subtree: true })

vscode.postMessage({ command: 'ready' })
