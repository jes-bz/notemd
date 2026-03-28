const LANGS = {
  en_US: {
    save: 'Save',
    copyMarkdown: 'Copy Markdown',
    copyHtml: 'Copy HTML',
    resetConfig: 'Reset config',
    resetConfirm: "Are you sure to reset the markdown-editor's config?",
  },
  ja_JP: {
    save: '保存する',
  },
  ko_KR: {
    save: '저장',
  },
  zh_CN: {
    save: '保存',
    copyMarkdown: '复制 Markdown',
    copyHtml: '复制 HTML',
    resetConfig: '重置配置',
    resetConfirm: '确定要重置 markdown-editor 的配置么?',
  },
}

const raw = navigator.language.replace('-', '_')
export const lang: keyof typeof LANGS = raw in LANGS
  ? (raw as keyof typeof LANGS)
  : 'en_US'

export function t(msg: string) {
  return (LANGS[lang] && LANGS[lang][msg]) || LANGS.en_US[msg]
}
