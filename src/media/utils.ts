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

export function confirm(msg: string, onOk: () => void) {
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

export function fixDarkTheme() {
  const ct = document.querySelector('[data-type="content-theme"]')
  ct.nextElementSibling.addEventListener('click', (e) => {
    if ((e.target as any).tagName !== 'BUTTON') return
    const type = (e.target as any).getAttribute('data-type')
    vditor.setTheme(type === 'dark' ? 'dark' : 'classic')
  })
}

export function fixPanelHover() {
  $('.vditor-panel').each((i, e) => {
    let timer
    $(e)
      .on('mouseenter', (e) => {
        timer && clearTimeout(timer)
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

export const fileToBase64 = async (file: File) => {
  return new Promise<string>((res, rej) => {
    const reader = new FileReader()
    reader.onload = function (evt) {
      res(evt.target.result.toString().split(',')[1])
    }
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

export function saveVditorOptions() {
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

export function handleToolbarClick() {
  $(
    '.vditor-toolbar .vditor-panel--left button, .vditor-toolbar .vditor-panel--arrow button'
  ).on('click', () => {
    setTimeout(() => {
      saveVditorOptions()
    }, 500)
  })
}

export function fixLinkClick() {
  const openLink = (url: string) => {
    vscode.postMessage({ command: 'open-link', href: url })
  }
  document.addEventListener('click', (e) => {
    const el = e.target as HTMLAnchorElement
    if (el.tagName === 'A') {
      openLink(el.href)
    }
  })
  window.open = (url: string, ...args: any[]) => {
    openLink(url)
    return window
  }
}

// Workaround for recursive execCommand: https://github.com/nwjs/nw.js/issues/3403
export function fixCut() {
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
