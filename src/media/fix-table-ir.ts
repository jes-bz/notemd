import { keyboard } from '@testing-library/user-event/dist/keyboard'
import $ from 'jquery'
import { updateHotkeyTip } from 'vditor/src/ts/util/compatibility'

const ICONS_SVG = `<svg style="position:absolute;width:0;height:0;overflow:hidden" xmlns="http://www.w3.org/2000/svg">
<defs>
<symbol id="vditor-icon-align-left" viewBox="0 0 32 32"><path d="M0.32 4.72h19.84c0.176 0 0.32-0.144 0.32-0.32v-2.24c0-0.176-0.144-0.32-0.32-0.32h-19.84c-0.176 0-0.32 0.144-0.32 0.32v2.24c0 0.176 0.144 0.32 0.32 0.32zM0.32 21.68h19.84c0.176 0 0.32-0.144 0.32-0.32v-2.24c0-0.176-0.144-0.32-0.32-0.32h-19.84c-0.176 0-0.32 0.144-0.32 0.32v2.24c0 0.176 0.144 0.32 0.32 0.32zM31.68 27.28h-31.36c-0.176 0-0.32 0.144-0.32 0.32v2.24c0 0.176 0.144 0.32 0.32 0.32h31.36c0.176 0 0.32-0.144 0.32-0.32v-2.24c0-0.176-0.144-0.32-0.32-0.32zM31.68 10.32h-31.36c-0.176 0-0.32 0.144-0.32 0.32v2.24c0 0.176 0.144 0.32 0.32 0.32h31.36c0.176 0 0.32-0.144 0.32-0.32v-2.24c0-0.176-0.144-0.32-0.32-0.32z"/></symbol>
<symbol id="vditor-icon-align-center" viewBox="0 0 32 32"><path d="M6.08 4.72h19.84c0.176 0 0.32-0.144 0.32-0.32v-2.24c0-0.176-0.144-0.32-0.32-0.32h-19.84c-0.176 0-0.32 0.144-0.32 0.32v2.24c0 0.176 0.144 0.32 0.32 0.32zM25.92 21.68c0.176 0 0.32-0.144 0.32-0.32v-2.24c0-0.176-0.144-0.32-0.32-0.32h-19.84c-0.176 0-0.32 0.144-0.32 0.32v2.24c0 0.176 0.144 0.32 0.32 0.32h19.84zM31.68 27.28h-31.36c-0.176 0-0.32 0.144-0.32 0.32v2.24c0 0.176 0.144 0.32 0.32 0.32h31.36c0.176 0 0.32-0.144 0.32-0.32v-2.24c0-0.176-0.144-0.32-0.32-0.32zM31.68 10.32h-31.36c-0.176 0-0.32 0.144-0.32 0.32v2.24c0 0.176 0.144 0.32 0.32 0.32h31.36c0.176 0 0.32-0.144 0.32-0.32v-2.24c0-0.176-0.144-0.32-0.32-0.32z"/></symbol>
<symbol id="vditor-icon-align-right" viewBox="0 0 32 32"><path d="M31.68 1.84h-19.84c-0.176 0-0.32 0.144-0.32 0.32v2.24c0 0.176 0.144 0.32 0.32 0.32h19.84c0.176 0 0.32-0.144 0.32-0.32v-2.24c0-0.176-0.144-0.32-0.32-0.32zM31.68 18.8h-19.84c-0.176 0-0.32 0.144-0.32 0.32v2.24c0 0.176 0.144 0.32 0.32 0.32h19.84c0.176 0 0.32-0.144 0.32-0.32v-2.24c0-0.176-0.144-0.32-0.32-0.32zM31.68 27.28h-31.36c-0.176 0-0.32 0.144-0.32 0.32v2.24c0 0.176 0.144 0.32 0.32 0.32h31.36c0.176 0 0.32-0.144 0.32-0.32v-2.24c0-0.176-0.144-0.32-0.32-0.32zM31.68 10.32h-31.36c-0.176 0-0.32 0.144-0.32 0.32v2.24c0 0.176 0.144 0.32 0.32 0.32h31.36c0.176 0 0.32-0.144 0.32-0.32v-2.24c0-0.176-0.144-0.32-0.32-0.32z"/></symbol>
<symbol id="vditor-icon-insert-row" viewBox="0 0 32 32"><path d="M30.668 23.04h-29.336c-0.736 0-1.332-0.572-1.332-1.28v-18.56c0-0.708 0.596-1.28 1.332-1.28h29.332c0.736 0 1.332 0.572 1.332 1.28v18.56c0.004 0.708-0.592 1.28-1.328 1.28zM9.92 4.8h-7.04v6.4h7.04v-6.4zM9.92 13.76h-7.04v6.4h7.04v-6.4zM19.52 4.8h-7.04v6.4h7.04v-6.4zM19.52 13.76h-7.04v6.4h7.04v-6.4zM29.12 4.8h-7.04v6.4h7.04v-6.4zM29.12 13.76h-7.04v6.4h7.04v-6.4zM31.68 30.08h-31.36c-0.176 0-0.32-0.144-0.32-0.32v-3.2c0-0.176 0.144-0.32 0.32-0.32h31.36c0.176 0 0.32 0.144 0.32 0.32v3.2c0 0.176-0.144 0.32-0.32 0.32z"/></symbol>
<symbol id="vditor-icon-insert-rowb" viewBox="0 0 32 32"><path d="M30.668 8.96h-29.336c-0.736 0-1.332 0.572-1.332 1.28v18.56c0 0.708 0.596 1.28 1.332 1.28h29.332c0.736 0 1.332-0.572 1.332-1.28v-18.56c0.004-0.708-0.592-1.28-1.328-1.28zM9.92 27.2h-7.04v-6.4h7.04v6.4zM9.92 18.24h-7.04v-6.4h7.04v6.4zM19.52 27.2h-7.04v-6.4h7.04v6.4zM19.52 18.24h-7.04v-6.4h7.04v6.4zM29.12 27.2h-7.04v-6.4h7.04v6.4zM29.12 18.24h-7.04v-6.4h7.04v6.4zM31.68 1.92h-31.36c-0.176 0-0.32 0.144-0.32 0.32v3.2c0 0.176 0.144 0.32 0.32 0.32h31.36c0.176 0 0.32-0.144 0.32-0.32v-3.2c0-0.176-0.144-0.32-0.32-0.32z"/></symbol>
<symbol id="vditor-icon-insert-column" viewBox="0 0 32 32"><path d="M29.76 0h-3.2c-0.176 0-0.32 0.144-0.32 0.32v31.36c0 0.176 0.144 0.32 0.32 0.32h3.2c0.176 0 0.32-0.144 0.32-0.32v-31.36c0-0.176-0.144-0.32-0.32-0.32zM21.76 0h-18.56c-0.708 0-1.28 0.596-1.28 1.332v29.332c0 0.736 0.572 1.332 1.28 1.332h18.56c0.708 0 1.28-0.596 1.28-1.332v-29.332c0-0.736-0.572-1.332-1.28-1.332zM11.2 29.12h-6.4v-7.04h6.4v7.04zM11.2 19.52h-6.4v-7.04h6.4v7.04zM11.2 9.92h-6.4v-7.04h6.4v7.04zM20.16 29.12h-6.4v-7.04h6.4v7.04zM20.16 19.52h-6.4v-7.04h6.4v7.04zM20.16 9.92h-6.4v-7.04h6.4v7.04z"/></symbol>
<symbol id="vditor-icon-insert-columnb" viewBox="0 0 32 32"><path d="M2.24 32h3.2c0.176 0 0.32-0.144 0.32-0.32v-31.36c0-0.176-0.144-0.32-0.32-0.32h-3.2c-0.176 0-0.32 0.144-0.32 0.32v31.36c0 0.176 0.144 0.32 0.32 0.32zM10.24 32h18.56c0.708 0 1.28-0.596 1.28-1.332v-29.332c0-0.736-0.572-1.332-1.28-1.332h-18.56c-0.708 0-1.28 0.596-1.28 1.332v29.332c0 0.736 0.572 1.332 1.28 1.332zM20.8 2.88h6.4v7.04h-6.4v-7.04zM20.8 12.48h6.4v7.04h-6.4v-7.04zM20.8 22.08h6.4v7.04h-6.4v-7.04zM11.84 2.88h6.4v7.04h-6.4v-7.04zM11.84 12.48h6.4v7.04h-6.4v-7.04zM11.84 22.08h6.4v7.04h-6.4v-7.04z"/></symbol>
<symbol id="vditor-icon-delete-row" viewBox="0 0 32 32"><path d="M28.129 16l4.035-4.843c0.11-0.134 0.095-0.331-0.039-0.445-0.055-0.047-0.126-0.075-0.201-0.075h-2.156c-0.095 0-0.181 0.043-0.24 0.114l-2.888 3.464-2.881-3.46c-0.059-0.071-0.15-0.114-0.24-0.114h-2.159c-0.075 0-0.146 0.028-0.201 0.075-0.134 0.11-0.154 0.311-0.039 0.445l4.031 4.839-4.035 4.843c-0.11 0.134-0.095 0.331 0.039 0.445 0.055 0.047 0.126 0.075 0.201 0.075h2.156c0.095 0 0.181-0.043 0.24-0.114l2.881-3.46 2.881 3.46c0.059 0.071 0.15 0.114 0.24 0.114h2.167c0.075 0 0.146-0.028 0.201-0.075 0.134-0.11 0.154-0.311 0.039-0.445l-4.031-4.843zM16.946 14.108h-16.393c-0.173 0-0.315 0.142-0.315 0.315v3.153c0 0.173 0.142 0.315 0.315 0.315h16.393c0.173 0 0.315-0.142 0.315-0.315v-3.152c0-0.173-0.142-0.315-0.315-0.315zM13.636 22.147h-2.364c-0.13 0-0.236 0.106-0.236 0.236v6.541h-9.852c-0.13 0-0.236 0.106-0.236 0.236v2.364c0 0.13 0.106 0.236 0.236 0.236h11.507c0.654 0 1.182-0.528 1.182-1.182v-8.197c0-0.13-0.106-0.236-0.236-0.236zM1.183 3.075h9.852v6.541c0 0.13 0.106 0.236 0.236 0.236h2.364c0.13 0 0.236-0.106 0.236-0.236v-8.197c0-0.654-0.528-1.182-1.182-1.182h-11.507c-0.13 0-0.236 0.106-0.236 0.236v2.364c0 0.13 0.106 0.236 0.236 0.236z"/></symbol>
<symbol id="vditor-icon-delete-column" viewBox="0 0 32 32"><path d="M21.563 21.195c-0.056-0.048-0.128-0.076-0.204-0.076h-2.188c-0.096 0-0.184 0.044-0.244 0.116l-2.928 3.512-2.924-3.512c-0.06-0.072-0.152-0.116-0.244-0.116h-2.192c-0.076 0-0.148 0.028-0.204 0.076-0.136 0.112-0.156 0.316-0.04 0.452l4.091 4.911-4.096 4.915c-0.112 0.136-0.096 0.336 0.04 0.452 0.056 0.048 0.128 0.076 0.204 0.076h2.188c0.096 0 0.184-0.044 0.244-0.116l2.924-3.512 2.924 3.512c0.06 0.072 0.152 0.116 0.244 0.116h2.2c0.076 0 0.148-0.028 0.204-0.076 0.136-0.112 0.156-0.316 0.04-0.452l-4.091-4.915 4.096-4.915c0.112-0.136 0.092-0.336-0.044-0.448zM14.4 17.28h3.2c0.176 0 0.32-0.144 0.32-0.32v-16.638c0-0.176-0.144-0.32-0.32-0.32h-3.2c-0.176 0-0.32 0.144-0.32 0.32v16.638c0 0.176 0.144 0.32 0.32 0.32zM9.521 10.961h-6.639v-9.999c0-0.132-0.108-0.24-0.24-0.24h-2.4c-0.132 0-0.24 0.108-0.24 0.24v11.679c0 0.664 0.536 1.2 1.2 1.2h8.319c0.132 0 0.24-0.108 0.24-0.24v-2.4c0-0.132-0.108-0.24-0.24-0.24zM31.758 0.722h-2.4c-0.132 0-0.24 0.108-0.24 0.24v9.999h-6.639c-0.132 0-0.24 0.108-0.24 0.24v2.4c0 0.132 0.108 0.24 0.24 0.24h8.319c0.664 0 1.2-0.536 1.2-1.2v-11.679c0-0.132-0.108-0.24-0.24-0.24z"/></symbol>
</defs></svg>`

const tablePanelId = 'fix-table-ir-wrapper'
let disableVscodeHotkeys = false

function ensureIconSprite() {
  if (!document.getElementById('vditor-icon-sprite')) {
    document.body.insertAdjacentHTML('afterbegin', ICONS_SVG.replace('<svg ', '<svg id="vditor-icon-sprite" '))
  }
}

const buttonDefs = [
  { type: 'left', label: 'Align left', hotkey: '⇧⌘L', icon: '#vditor-icon-align-left' },
  { type: 'center', label: 'Align center', hotkey: '⇧⌘C', icon: '#vditor-icon-align-center' },
  { type: 'right', label: 'Align right', hotkey: '⇧⌘R', icon: '#vditor-icon-align-right' },
  { type: 'insertRowA', label: 'Insert row above', hotkey: '⇧⌘F', icon: '#vditor-icon-insert-rowb' },
  { type: 'insertRowB', label: 'Insert row below', hotkey: '⌘=', icon: '#vditor-icon-insert-row' },
  { type: 'insertColumnL', label: 'Insert column left', hotkey: '⇧⌘G', icon: '#vditor-icon-insert-columnb' },
  { type: 'insertColumnR', label: 'Insert column right', hotkey: '⇧⌘=', icon: '#vditor-icon-insert-column' },
  { type: 'deleteRow', label: 'Delete row', hotkey: '⌘-', icon: '#vditor-icon-delete-row' },
  { type: 'deleteColumn', label: 'Delete column', hotkey: '⇧⌘-', icon: '#vditor-icon-delete-column' },
]

const handleMap: Record<string, string[]> = {
  left: ['{ctrl}{shift}l{/shift}{/ctrl}', '{meta}{shift}l{/shift}{/meta}'],
  center: ['{ctrl}{shift}c{/shift}{/ctrl}', '{meta}{shift}c{/shift}{/meta}'],
  right: ['{ctrl}{shift}r{/shift}{/ctrl}', '{meta}{shift}r{/shift}{/meta}'],
  insertRowA: ['{ctrl}{shift}f{/shift}{/ctrl}', '{meta}{shift}f{/shift}{/meta}'],
  insertRowB: ['{ctrl}={/ctrl}', '{meta}={/meta}'],
  deleteRow: ['{ctrl}-{/ctrl}', '{meta}-{/meta}'],
  insertColumnL: ['{ctrl}{shift}g{/shift}{/ctrl}', '{meta}{shift}g{/shift}{/meta}'],
  insertColumnR: ['{ctrl}{shift}+{/shift}{/ctrl}', '{meta}{shift}={/shift}{/meta}'],
  deleteColumn: ['{ctrl}{shift}_{/shift}{/ctrl}', '{meta}{shift}-{/shift}{/meta}'],
}

export function fixTableIr() {
  ensureIconSprite()
  const eventRoot = vditor.vditor.ir.element

  function insertTablePanel() {
    let tablePanel = document.getElementById(tablePanelId) as HTMLDivElement | null
    if (!tablePanel) {
      tablePanel = document.createElement('div')
      tablePanel.id = tablePanelId
      document.body.appendChild(tablePanel)

      const panel = document.createElement('div')
      panel.className = 'vditor-panel vditor-panel--none vditor-panel-ir'
      panel.style.cssText = 'position:fixed;display:none;z-index:10000;background:#252526;'

      for (const btn of buttonDefs) {
        const button = document.createElement('button')
        button.type = 'button'
        button.setAttribute('aria-label', `${btn.label}<${updateHotkeyTip(btn.hotkey)}>`)
        button.setAttribute('data-type', btn.type)
        button.className = 'vditor-icon vditor-tooltipped vditor-tooltipped__n'
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use')
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', btn.icon)
        svg.appendChild(use)
        button.appendChild(svg)
        panel.appendChild(button)
      }

      tablePanel.appendChild(panel)

      $(panel).on('click', '.vditor-icon', (e) => {
        const type = $(e.target).closest('[data-type]').attr('data-type')
        if (!type || !handleMap[type]) return
        const k = handleMap[type][
          navigator.platform.toLowerCase().includes('mac') ? 1 : 0
        ]
        disableVscodeHotkeys = true
        Promise.resolve(
          keyboard(k, {
            document: { body: eventRoot } as any,
          })
        ).finally(() => {
          disableVscodeHotkeys = false
        })
        e.stopPropagation()
      })
    }
    return tablePanel.querySelector('.vditor-panel') as HTMLDivElement
  }

  eventRoot.addEventListener('click', (e) => {
    if (vditor.getCurrentMode() !== 'ir') return
    const tablePanel = insertTablePanel()
    const clickEl = (e.target as HTMLElement).closest('td, th, tr')
    if (clickEl) {
      const rect = clickEl.getBoundingClientRect()
      tablePanel.style.top = rect.bottom + 'px'
      tablePanel.style.left = rect.right + 'px'
      tablePanel.style.display = 'block'
    } else {
      tablePanel.style.display = 'none'
    }
  })

  eventRoot.addEventListener('scroll', () => {
    const tablePanel = document.getElementById(tablePanelId)
    if (tablePanel) {
      const panel = tablePanel.querySelector('.vditor-panel') as HTMLElement
      if (panel) panel.style.display = 'none'
    }
  })

  const stopEvent = (e: KeyboardEvent) => {
    if (disableVscodeHotkeys) {
      e.preventDefault()
      e.stopPropagation()
    }
  }
  eventRoot.addEventListener('keydown', stopEvent)
  eventRoot.addEventListener('keyup', stopEvent)
}
