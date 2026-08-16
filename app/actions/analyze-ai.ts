'use server'

import { eq } from 'drizzle-orm'
import { generateText, Output } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { db } from '@/lib/db'
import { aiAgents } from '@/lib/db/schema'
import { emptyProperty, referenceOptions, type PropertyRecord } from '@/lib/property/types'
import type { AgentProvider } from '@/lib/agents/types'

function buildModel(provider: AgentProvider, model: string, apiKey: string) {
  switch (provider) {
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(model)
    case 'openai':
      return createOpenAI({ apiKey })(model)
    case 'anthropic':
      return createAnthropic({ apiKey })(model)
  }
}

function enumOrEmpty(options: readonly string[]) {
  return z
    .enum(['', ...options] as [string, ...string[]])
    .nullable()
    .describe(`أحد القيم التالية فقط، أو فارغ إن لم تُذكر: ${options.join(' / ')}`)
}

const freeText = (description: string) => z.string().nullable().describe(description)

const propertyExtractionSchema = z.object({
  title: freeText('عنوان مختصر وجذاب للعقار مكوّن من نوع العقار وأهم ميزة وموقعه، بدون رموز تعبيرية'),
  type: enumOrEmpty(referenceOptions.types),
  category: enumOrEmpty(referenceOptions.categories),
  listingType: enumOrEmpty(referenceOptions.listingTypes),
  price: freeText('السعر الإجمالي بالأرقام فقط بدون كلمة جنيه أو فواصل أو رموز'),
  size: freeText('المساحة بالمتر المربع، أرقام فقط'),
  beds: freeText('عدد غرف النوم، رقم فقط'),
  baths: freeText('عدد الحمامات، رقم فقط'),
  floor: enumOrEmpty(referenceOptions.floors),
  master: enumOrEmpty(referenceOptions.yesNo).describe('نعم إذا ذُكرت غرفة ماستر ضمن الغرف، وإلا لا'),
  elevator: enumOrEmpty(referenceOptions.yesNo),
  finishing: enumOrEmpty(referenceOptions.finishings),
  view: enumOrEmpty(referenceOptions.views),
  facade: freeText('اتجاه الواجهة كما ورد في النص (مثل: غربي بحري، أمامي)'),
  parkingAvailable: enumOrEmpty(referenceOptions.yesNo),
  city: enumOrEmpty(referenceOptions.cities),
  region: freeText('المنطقة أو الحي الرئيسي المذكور داخل المدينة'),
  district: freeText('الحي الفرعي أو الاسم الدقيق للحي داخل المدينة إن وُجد'),
  features: freeText(
    'قائمة نقطية مرتبة بكل التفاصيل والمميزات الإضافية المذكورة في النص التي لم تُستخرج في حقل مستقل (مثل الاستلام، التشطيب بالتفصيل، القريب من الخدمات)، بدون رموز تعبيرية، كل نقطة في سطر يبدأ بعلامة -',
  ),
})

type ExtractionOutput = z.infer<typeof propertyExtractionSchema>

async function getActiveAgentRow() {
  const [row] = await db.select().from(aiAgents).where(eq(aiAgents.isActive, true)).limit(1)
  return row
}

export async function analyzePropertyWithAI(text: string): Promise<{
  record: PropertyRecord
  detectedFields: (keyof PropertyRecord)[]
  agentName: string
}> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('الصق تفاصيل العقار أولًا.')

  const agent = await getActiveAgentRow()
  if (!agent) {
    throw new Error('لا يوجد وكيل ذكاء اصطناعي مُفعّل. أضف وكيلًا وفعّله من صفحة إعدادات الوكلاء.')
  }

  const model = buildModel(agent.provider as AgentProvider, agent.model, agent.apiKey)

  let output: ExtractionOutput
  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: propertyExtractionSchema }),
      system:
        'أنت محلل بيانات عقارية محترف يعمل في السوق المصري. تقرأ إعلانات عقارية مكتوبة بأسلوب تسويقي حر مليء بالرموز التعبيرية والنقاط، وتفهم السياق كما يفهمه إنسان خبير، ثم توزّع المعلومات في الحقول المطلوبة بدقة. تجاهل الرموز التعبيرية وعلامات التعداد تمامًا واعتبرها فواصل فقط. اربط بين الجمل المتفرقة لفهم حقيقة واحدة (مثل استخراج عدد الغرف ووجود غرفة ماستر من نفس الجملة). اترك أي حقل فارغًا إن لم يُذكر في النص، ولا تخترع معلومات غير موجودة.',
      prompt: `النص المطلوب تحليله:\n\n${trimmed}`,
    })
    output = result.output
  } catch (error) {
    console.error('[v0] AI property extraction failed:', error)
    throw new Error('تعذر التحليل عبر الوكيل الذكي. تأكد من صحة مفتاح API وحدود الاستخدام، ثم حاول مرة أخرى.')
  }

  const record: PropertyRecord = { ...emptyProperty }
  const detectedFields: (keyof PropertyRecord)[] = []

  for (const [key, value] of Object.entries(output) as [keyof ExtractionOutput, string | null][]) {
    const normalized = (value ?? '').trim()
    if (normalized) {
      record[key] = normalized
      detectedFields.push(key)
    }
  }

  return { record, detectedFields, agentName: agent.name }
}
