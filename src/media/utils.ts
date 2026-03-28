import $ from 'jquery'
require('jquery-confirm')(window, $)
import 'jquery-confirm/css/jquery-confirm.css'

import Vditor from 'vditor'
window.vscode =
  (window as any).acquireVsCodeApi && (window as any).acquireVsCodeApi()
;(window as any).global = window

declare global {
  export const vditor: Vditor
  export const vscode: any
  interface Window {
    vditor: Vditor
    vscode: any
    global: Window
  }
}

export function confirm(msg: string, onOk: () => void): void {
  $.confirm({
    title: '',
    animation: 'top',
    closeAnimation: 'top',
    animateFromElement: false,
    boxWidth: '300px',
    useBootstrap: false,
    content: msg,
    buttons: {
      cancel: { text: 'Cancel' },
      confirm: { text: 'Confirm', action: onOk },
    },
  })
}

export function fixDarkTheme(): void {
  const ct = document.querySelector('[data-type="content-theme"]')
  if (!ct?.nextElementSibling) return
  ct.nextElementSibling.addEventListener('click', (e) => {
    if ((e.target as any).tagName !== 'BUTTON') return
    const type = (e.target as any).getAttribute('data-type')
    vditor.setTheme(type === 'dark' ? 'dark' : 'classic')
  })
}

export function fixPanelHover(): void {
  $('.vditor-panel').each((i, e) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    $(e)
      .on('mouseenter', (e) => {
        clearTimeout(timer)
        e.currentTarget.classList.add('vditor-panel_hover')
      })
      .on('mouseleave', (e) => {
        const el = e.currentTarget
        timer = setTimeout(() => {
          el.classList.remove('vditor-panel_hover')
        }, 2000)
      })
  })
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function saveVditorOptions(): void {
  const vditorOptions = {
    theme: vditor.vditor.options.theme,
    mode: vditor.vditor.currentMode,
    preview: vditor.vditor.options.preview,
  }
  vscode.postMessage({
    command: 'save-options',
    options: vditorOptions,
  })
}

export function handleToolbarClick(): void {
  $(
    '.vditor-toolbar .vditor-panel--left button, .vditor-toolbar .vditor-panel--arrow button'
  ).on('click', () => {
    setTimeout(() => {
      saveVditorOptions()
    }, 500)
  })
}

export function fixLinkClick(): void {
  document.addEventListener('click', (e) => {
    const el = e.target as HTMLAnchorElement
    if (el.tagName === 'A') {
      vscode.postMessage({ command: 'open-link', href: el.href })
    }
  })
  window.open = (url: string) => {
    vscode.postMessage({ command: 'open-link', href: url })
    return window
  }
}

// Workaround for recursive execCommand: https://github.com/nwjs/nw.js/issues/3403
export function fixCut(): void {
  const _exec = document.execCommand.bind(document)
  document.execCommand = (cmd, ...args) => {
    if (cmd === 'delete') {
      setTimeout(() => {
        return _exec(cmd, ...args)
      })
    } else {
      return _exec(cmd, ...args)
    }
  }
}
