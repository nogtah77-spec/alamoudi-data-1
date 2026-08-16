import { listAgents } from '@/app/actions/agents'
import { PropertyAnalyzer } from '@/components/property-analyzer'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const agents = await listAgents()
  const activeAgent = agents.find((agent) => agent.isActive) ?? null
  return <PropertyAnalyzer activeAgentName={activeAgent?.name ?? null} />
}
