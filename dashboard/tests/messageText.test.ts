// Tests for how the agent panel reads the agent's Markdown. Run with `npm test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'

const { messageBlocks } = await import('../src/features/assistant/messageText.ts')

test('paragraphs, lists, checklists, and titled cards read into blocks', () => {
  const text = [
    'I drafted your depot and fleet from that.',
    '✓ Found Jl. Layur VII on the map\n? I assumed the break can start any time 12:00–13:00',
    '**Why it looks like this**\n- Drivers reload at the depot.\n- Breaks fall between 12:05 and 12:35.',
    '**One order needs you**\n"Pak Hadi" has no place on the map.\nWhat should I do?',
  ].join('\n\n')
  assert.deepEqual(messageBlocks(text), [
    { kind: 'paragraph', text: 'I drafted your depot and fleet from that.' },
    {
      kind: 'checks',
      items: [
        { done: true, text: 'Found Jl. Layur VII on the map' },
        { done: false, text: 'I assumed the break can start any time 12:00–13:00' },
      ],
    },
    { kind: 'card', title: 'Why it looks like this', body: { kind: 'list', items: ['Drivers reload at the depot.', 'Breaks fall between 12:05 and 12:35.'] } },
    { kind: 'card', title: 'One order needs you', body: { kind: 'paragraph', text: '"Pak Hadi" has no place on the map.\nWhat should I do?' } },
  ])
})

test('a line that only looks like a list item stays in its paragraph', () => {
  assert.deepEqual(messageBlocks('Driver 002 +6 min.\n- not a list'), [{ kind: 'paragraph', text: 'Driver 002 +6 min.\n- not a list' }])
  assert.deepEqual(messageBlocks('  \n\n'), [])
})
