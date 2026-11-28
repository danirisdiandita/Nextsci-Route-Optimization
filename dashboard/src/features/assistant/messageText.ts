// The agent writes a small part of Markdown, as a language model would: paragraphs split by a blank line,
// "- " lists, "✓ " and "? " checklists, and a "**Title**" line that starts a card. This reads it into blocks.

export type MessageBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'checks'; items: { done: boolean; text: string }[] }
  | { kind: 'card'; title: string; body: MessageBlock | null }

function block(chunk: string): MessageBlock {
  const lines = chunk.split('\n')
  const title = /^\*\*(.+)\*\*$/.exec(lines[0])
  if (title) return { kind: 'card', title: title[1], body: lines.length > 1 ? block(lines.slice(1).join('\n')) : null }
  if (lines.every((l) => l.startsWith('- '))) return { kind: 'list', items: lines.map((l) => l.slice(2)) }
  if (lines.every((l) => /^[✓?] /.test(l))) return { kind: 'checks', items: lines.map((l) => ({ done: l.startsWith('✓'), text: l.slice(2) })) }
  return { kind: 'paragraph', text: chunk }
}

export function messageBlocks(text: string): MessageBlock[] {
  return text
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean)
    .map(block)
}
