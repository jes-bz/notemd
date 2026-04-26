import * as vscode from 'vscode'
import * as NodePath from 'path'

const DEFAULT_PROMPT =
  'Extract all text from this image exactly as it appears. Return only the raw text with no commentary, no markdown, no quoting. If the image contains no text, return an empty string.'

const IMAGE_EXTS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
}

export interface OcrConfig {
  endpoint: string
  apiKey: string
  model: string
  prompt: string
}

export async function getOcrConfig(context: vscode.ExtensionContext): Promise<OcrConfig> {
  const c = vscode.workspace.getConfiguration('notemd')
  const apiKey = await context.secrets.get('notemd.ocrApiKey') || ''
  return {
    endpoint: (c.get<string>('ocr.endpoint') || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    apiKey,
    model: c.get<string>('ocr.model') || 'gpt-4o-mini',
    prompt: c.get<string>('ocr.prompt') || DEFAULT_PROMPT,
  }
}

export function getImageMime(absPath: string): string | null {
  const ext = NodePath.extname(absPath).toLowerCase()
  return IMAGE_EXTS[ext] || null
}

export async function ocrImageFile(absPath: string, cfg: OcrConfig): Promise<string> {
  const mime = getImageMime(absPath)
  if (!mime) throw new Error(`Unsupported image type: ${absPath}`)
  if (!cfg.apiKey) throw new Error('notemd.ocr.apiKey not configured')

  const b64 = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(absPath))).toString('base64')
  const dataUrl = `data:${mime};base64,${b64}`

  const body = {
    model: cfg.model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: cfg.prompt },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  }

  const res = await fetch(`${cfg.endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`OCR API ${res.status}: ${txt.slice(0, 300)}`)
  }

  const json: any = await res.json()
  const text = json?.choices?.[0]?.message?.content
  if (typeof text !== 'string') throw new Error('OCR API returned no text content')
  return text.trim()
}

export function escapeAlt(s: string): string {
  return s
    .replace(/\r?\n/g, ' ')
    .replace(/[[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function resolveLocalImage(mdFsPath: string, href: string): Promise<string | null> {
  if (/^[a-z]+:\/\//i.test(href) || href.startsWith('data:')) return null

  let decodedHref = href
  try {
    decodedHref = decodeURIComponent(href)
  } catch {
    // ignore
  }

  const pathsToTry = new Set([decodedHref, href])
  for (const p of pathsToTry) {
    const abs = NodePath.resolve(NodePath.dirname(mdFsPath), p)
    if (!getImageMime(abs)) continue
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(abs))
      const ws = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(mdFsPath))
      if (ws && !abs.startsWith(ws.uri.fsPath + NodePath.sep)) continue
      return abs
    } catch {
      continue
    }
  }

  return null
}
