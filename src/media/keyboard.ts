const MOD_KEY_MAP: Record<string, string> = {
	cmd: 'Meta', ctrl: 'Control', meta: 'Meta', shift: 'Shift',
}

function parseKeys(text: string): { descriptor: string, isClosing: boolean }[] {
	const keys: { descriptor: string, isClosing: boolean }[] = []
	let i = 0
	while (i < text.length) {
		if (text[i] === '{') {
			i++
			const isClosing = text[i] === '/' ? (i++, true) : false
			const start = i
			while (i < text.length && /\w/.test(text[i])) i++
			keys.push({ descriptor: text.substring(start, i), isClosing })
			if (text[i] === '}') i++
		}
		i++
	}
	return keys
}

function fireKey(
	type: string, element: Element, key: string, code: string,
	modifiers: Record<string, boolean>,
): void {
	element.dispatchEvent(new KeyboardEvent(type, {
		key, code,
		altKey: modifiers.alt,
		ctrlKey: modifiers.ctrl,
		metaKey: modifiers.meta,
		shiftKey: modifiers.shift,
		bubbles: true, cancelable: true,
		keyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : undefined,
	} as KeyboardEventInit))
}

export function keyboard(text: string, options: { document?: any }): void {
	const element: Element = (options?.document || document).body
	const keys = parseKeys(text)
	const modifiers: Record<string, boolean> = {
		alt: false, ctrl: false, meta: false, shift: false,
	}

	for (const { descriptor, isClosing } of keys) {
		const modKey = descriptor.toLowerCase()
		const isMod = modKey in MOD_KEY_MAP
		const modAlias = modKey === 'cmd' ? 'meta' : modKey
		const key = MOD_KEY_MAP[modAlias] ?? descriptor
		const code = descriptor.length === 1 ? `Key${descriptor.toUpperCase()}` : descriptor

		if (isMod && !isClosing) {
			modifiers[modAlias] = true
			fireKey('keydown', element, key, code, modifiers)
		} else if (isMod && isClosing) {
			fireKey('keyup', element, key, code, modifiers)
			modifiers[modAlias] = false
		} else {
			fireKey('keydown', element, key, code, modifiers)
			fireKey('keyup', element, key, code, modifiers)
		}
	}
}
