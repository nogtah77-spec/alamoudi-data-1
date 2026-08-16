export type AgentProvider = 'google' | 'openai' | 'anthropic'

export const providerLabels: Record<AgentProvider, string> = {
  google: 'Google Gemini',
  openai: 'OpenAI (ChatGPT)',
  anthropic: 'Anthropic (Claude)',
}

export const providerModelOptions: Record<AgentProvider, string[]> = {
  google: ['gemini-3.1-pro-preview', 'gemini-3.7-flash', 'gemini-3.5-flash-lite'],
  openai: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o'],
  anthropic: ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4.5'],
}

// Safe shape returned to the client — the raw API key is never sent to the browser.
export type SafeAgent = {
  id: number
  name: string
  provider: AgentProvider
  model: string
  isActive: boolean
  keyPreview: string
  createdAt: string
}

export type AgentFormInput = {
  name: string
  provider: AgentProvider
  model: string
  apiKey?: string
}
