'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { aiAgents } from '@/lib/db/schema'
import {
  providerModelOptions,
  type AgentFormInput,
  type AgentProvider,
  type SafeAgent,
} from '@/lib/agents/types'

const supportedProviders = Object.keys(providerModelOptions) as AgentProvider[]

function assertValidProviderAndModel(provider: AgentProvider, model: string) {
  if (!supportedProviders.includes(provider)) {
    throw new Error('مزوّد الذكاء الاصطناعي غير مدعوم')
  }
  if (!providerModelOptions[provider].includes(model)) {
    throw new Error('النموذج المختار غير متوافق مع هذا المزوّد')
  }
}

function maskKey(apiKey: string) {
  const trimmed = apiKey.trim()
  if (trimmed.length <= 6) return '••••••'
  return `${trimmed.slice(0, 3)}••••${trimmed.slice(-4)}`
}

function toSafeAgent(row: typeof aiAgents.$inferSelect): SafeAgent {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider as AgentProvider,
    model: row.model,
    isActive: row.isActive,
    keyPreview: maskKey(row.apiKey),
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listAgents(): Promise<SafeAgent[]> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Agent query timed out')), 1500)
  })

  try {
    const rows = await Promise.race([
      db.select().from(aiAgents).orderBy(aiAgents.createdAt),
      timeout,
    ])
    return rows.map(toSafeAgent)
  } catch (error) {
    console.error('[v0] Failed to load agents:', error)
    return []
  }
}

export async function createAgent(input: AgentFormInput): Promise<SafeAgent> {
  const name = input.name.trim()
  const apiKey = input.apiKey?.trim()
  if (!name) throw new Error('اسم الوكيل مطلوب')
  if (!apiKey) throw new Error('مفتاح API مطلوب')
  assertValidProviderAndModel(input.provider, input.model)

  const row = await db.transaction(async (tx) => {
    const [activeAgent] = await tx.select().from(aiAgents).where(eq(aiAgents.isActive, true)).limit(1)
    const shouldBeActive = !activeAgent

    const [inserted] = await tx
      .insert(aiAgents)
      .values({
        name,
        provider: input.provider,
        model: input.model,
        apiKey,
        isActive: shouldBeActive,
      })
      .returning()

    return inserted
  })

  revalidatePath('/agents')
  return toSafeAgent(row)
}

export async function updateAgent(id: number, input: AgentFormInput): Promise<SafeAgent> {
  const name = input.name.trim()
  if (!name) throw new Error('اسم الوكيل مطلوب')
  assertValidProviderAndModel(input.provider, input.model)

  const values: Partial<typeof aiAgents.$inferInsert> = {
    name,
    provider: input.provider,
    model: input.model,
  }
  const apiKey = input.apiKey?.trim()
  if (apiKey) values.apiKey = apiKey

  const [row] = await db.update(aiAgents).set(values).where(eq(aiAgents.id, id)).returning()
  if (!row) throw new Error('الوكيل غير موجود')

  revalidatePath('/agents')
  return toSafeAgent(row)
}

export async function deleteAgent(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [deleted] = await tx.delete(aiAgents).where(eq(aiAgents.id, id)).returning()
    if (deleted?.isActive) {
      const [next] = await tx
        .select()
        .from(aiAgents)
        .orderBy(aiAgents.createdAt)
        .limit(1)
      if (next) await tx.update(aiAgents).set({ isActive: true }).where(eq(aiAgents.id, next.id))
    }
  })
  revalidatePath('/agents')
}

export async function setActiveAgent(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [target] = await tx.select().from(aiAgents).where(eq(aiAgents.id, id)).limit(1)
    if (!target) throw new Error('الوكيل غير موجود')

    await tx.update(aiAgents).set({ isActive: false }).where(eq(aiAgents.isActive, true))
    await tx.update(aiAgents).set({ isActive: true }).where(eq(aiAgents.id, id))
  })
  revalidatePath('/agents')
}
