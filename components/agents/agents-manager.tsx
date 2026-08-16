'use client'

import { useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { createAgent, deleteAgent, setActiveAgent, updateAgent } from '@/app/actions/agents'
import { ThemeToggle } from '@/components/theme-toggle'
import { providerLabels, providerModelOptions, type AgentProvider, type SafeAgent } from '@/lib/agents/types'

type AgentsManagerProps = {
  initialAgents: SafeAgent[]
}

const PROVIDER_KEY_LINKS: Record<AgentProvider, { label: string; href: string }> = {
  google: { label: 'الحصول على مفتاح من Google AI Studio', href: 'https://aistudio.google.com/apikey' },
  openai: { label: 'الحصول على مفتاح من OpenAI Platform', href: 'https://platform.openai.com/api-keys' },
  anthropic: { label: 'الحصول على مفتاح من Anthropic Console', href: 'https://console.anthropic.com/settings/keys' },
}

const EMPTY_FORM = { name: '', provider: 'google' as AgentProvider, model: providerModelOptions.google[0], apiKey: '' }

export function AgentsManager({ initialAgents }: AgentsManagerProps) {
  const [agents, setAgents] = useState<SafeAgent[]>(initialAgents)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const activeAgent = useMemo(() => agents.find((agent) => agent.isActive) ?? null, [agents])

  function openCreateForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
    setFormOpen(true)
  }

  function openEditForm(agent: SafeAgent) {
    setEditingId(agent.id)
    setForm({ name: agent.name, provider: agent.provider, model: agent.model, apiKey: '' })
    setError('')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setError('')
  }

  function handleProviderChange(provider: AgentProvider) {
    setForm((current) => ({ ...current, provider, model: providerModelOptions[provider][0] }))
  }

  function handleSubmit() {
    if (!form.name.trim()) { setError('يرجى إدخال اسم للوكيل.'); return }
    if (!editingId && !form.apiKey.trim()) { setError('يرجى إدخال مفتاح API.'); return }

    setError('')
    startTransition(async () => {
      try {
        if (editingId) {
          const updated = await updateAgent(editingId, form)
          setAgents((current) => current.map((agent) => (agent.id === updated.id ? updated : agent)))
        } else {
          const created = await createAgent(form)
          setAgents((current) => [...current, created])
        }
        closeForm()
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'حدث خطأ غير متوقع.')
      }
    })
  }

  function handleSetActive(id: number) {
    setPendingAction(`activate-${id}`)
    startTransition(async () => {
      await setActiveAgent(id)
      setAgents((current) => current.map((agent) => ({ ...agent, isActive: agent.id === id })))
      setPendingAction(null)
    })
  }

  function handleDelete(id: number) {
    setPendingAction(`delete-${id}`)
    startTransition(async () => {
      await deleteAgent(id)
      setAgents((current) => {
        const remaining = current.filter((agent) => agent.id !== id)
        const removedWasActive = current.find((agent) => agent.id === id)?.isActive
        if (removedWasActive && remaining.length > 0) {
          remaining[0] = { ...remaining[0], isActive: true }
        }
        return remaining
      })
      setPendingAction(null)
    })
  }

  return (
    <main dir="rtl" className="min-h-screen bg-transparent text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[900px] flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card shadow-sm ring-1 ring-primary/10">
              <Image src="/icon.svg" alt="شعار محلل بيانات العقار" fill sizes="48px" className="object-contain p-2" priority />
            </span>
            <div>
              <h1 className="text-base font-black tracking-tight">إعدادات وكلاء الذكاء الاصطناعي</h1>
              <p className="text-xs text-muted-foreground">إضافة وإدارة الوكلاء والتبديل بينهم لاستخدامهم في المحلل الذكي</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link
              href="/"
              className="flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              الرجوع للأداة الرئيسية
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[900px] flex-col gap-6 px-5 py-6 sm:px-8">
        <section className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs leading-6 text-foreground">
          <KeyRound size={16} className="mt-0.5 shrink-0 text-primary" />
          <p>
            كل وكيل يستخدم مفتاح API خاص بك مباشرة من مزوّد الذكاء الاصطناعي (Google، OpenAI أو Anthropic)، دون أي طبقة وسيطة.
            المفاتيح تُخزَّن بشكل آمن في قاعدة البيانات ولا تُعرض كاملة بعد الحفظ. يُستخدم الوكيل «النشط» فقط في المحلل الذكي بالصفحة الرئيسية.
          </p>
        </section>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">
            الوكلاء المضافون <span className="text-muted-foreground">({agents.length})</span>
          </h2>
          {!formOpen && (
            <button
              type="button"
              onClick={openCreateForm}
              className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:opacity-90"
            >
              <Plus size={16} />
              إضافة وكيل
            </button>
          )}
        </div>

        {agents.length === 0 && !formOpen && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
            <Bot size={28} className="text-muted-foreground" />
            <p className="text-sm font-bold">لا يوجد وكلاء بعد</p>
            <p className="text-xs text-muted-foreground">أضف أول وكيل ذكاء اصطناعي لتفعيل المحلل الذكي.</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {agents.map((agent) => (
            <article
              key={agent.id}
              className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                agent.isActive ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                  <Sparkles size={18} strokeWidth={2} />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold">{agent.name}</h3>
                    {agent.isActive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                        <CheckCircle2 size={11} />
                        نشط الآن
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {providerLabels[agent.provider]} · {agent.model} · مفتاح {agent.keyPreview}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!agent.isActive && (
                  <button
                    type="button"
                    onClick={() => handleSetActive(agent.id)}
                    disabled={isPending}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    {pendingAction === `activate-${agent.id}` ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    تفعيل
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEditForm(agent)}
                  className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label={`تعديل ${agent.name}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(agent.id)}
                  disabled={isPending}
                  className="flex size-9 items-center justify-center rounded-lg border border-destructive/25 text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                  aria-label={`حذف ${agent.name}`}
                >
                  {pendingAction === `delete-${agent.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </article>
          ))}
        </div>

        {formOpen && (
          <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{editingId ? 'تعديل الوكيل' : 'إضافة وكيل جديد'}</h3>
              <button type="button" onClick={closeForm} className="text-muted-foreground hover:text-foreground" aria-label="إغلاق">
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-xs font-bold text-foreground">
                اسم الوكيل
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="مثال: Gemini الرئيسي"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-bold text-foreground">
                المزوّد
                <select
                  value={form.provider}
                  onChange={(event) => handleProviderChange(event.target.value as AgentProvider)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  {Object.entries(providerLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-bold text-foreground">
                النموذج
                <select
                  value={form.model}
                  onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  {providerModelOptions[form.provider].map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-bold text-foreground">
                مفتاح API
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
                  placeholder={editingId ? 'اتركه فارغًا للاحتفاظ بالمفتاح الحالي' : 'الصق مفتاح API هنا'}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                  dir="ltr"
                />
              </label>
            </div>

            <a
              href={PROVIDER_KEY_LINKS[form.provider].href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              {PROVIDER_KEY_LINKS[form.provider].label}
              <ExternalLink size={12} />
            </a>

            {error && (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {isPending && <Loader2 size={14} className="animate-spin" />}
                {editingId ? 'حفظ التعديلات' : 'إضافة الوكيل'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="flex h-10 items-center rounded-xl border border-border px-4 text-sm font-bold text-muted-foreground transition hover:bg-muted"
              >
                إلغاء
              </button>
            </div>
          </section>
        )}

        {activeAgent && (
          <p className="text-center text-xs text-muted-foreground">
            الوكيل النشط حاليًا في المحلل الذكي: <span className="font-bold text-foreground">{activeAgent.name}</span>
          </p>
        )}
      </div>
    </main>
  )
}
