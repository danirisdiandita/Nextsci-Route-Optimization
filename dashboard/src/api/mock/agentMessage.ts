import type { AgentMessage } from '../types.ts'
import { mutate, newId, now, query } from './db.ts'

export type AgentMessageInput = Pick<AgentMessage, 'role' | 'kind' | 'text'> & Partial<Pick<AgentMessage, 'attachments' | 'suggestions' | 'proposalId' | 'at'>>

/** The conversation and today's log, oldest first. */
export const listAgentMessages = () => query((db) => db.agent_message)

export const createAgentMessage = (input: AgentMessageInput) =>
  mutate((db) => {
    const text = input.text.trim()
    if (!text && !input.attachments?.length) throw new Error('Write a message or attach a file.')
    const message: AgentMessage = {
      id: newId('agent_message'),
      role: input.role,
      kind: input.kind,
      text,
      attachments: input.attachments ?? [],
      suggestions: input.suggestions ?? [],
      proposalId: input.proposalId ?? null,
      at: input.at ?? null,
      createdAt: now(),
    }
    db.agent_message.push(message)
    return message
  })

export const clearAgentMessages = () =>
  mutate((db) => {
    db.agent_message = []
  })
