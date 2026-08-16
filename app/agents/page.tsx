import { listAgents } from '@/app/actions/agents'
import { AgentsManager } from '@/components/agents/agents-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'إعدادات وكلاء الذكاء الاصطناعي — محلل بيانات العقار',
  description: 'إضافة وإدارة وكلاء الذكاء الاصطناعي (Gemini، ChatGPT، Claude) المستخدمين في التحليل الذكي لبيانات العقار.',
}

export default async function AgentsPage() {
  const agents = await listAgents()
  return <AgentsManager initialAgents={agents} />
}
