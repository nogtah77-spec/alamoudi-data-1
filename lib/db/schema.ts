import { boolean, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const aiAgents = pgTable('ai_agents', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  provider: text('provider').notNull(), // 'google' | 'openai' | 'anthropic'
  model: text('model').notNull(),
  apiKey: text('api_key').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
