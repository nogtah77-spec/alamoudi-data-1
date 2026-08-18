'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, RotateCcw, Settings } from 'lucide-react'
import { IntakePanel } from '@/components/property-analyzer/intake-panel'
import { FieldsGrid } from '@/components/property-analyzer/fields-grid'
import { ExportMenu } from '@/components/property-analyzer/export-menu'
import { ThemeToggle } from '@/components/theme-toggle'
import { analyzePropertyWithAI } from '@/app/actions/analyze-ai'
import {
  DOCX_EXTENSIONS,
  SPREADSHEET_EXTENSIONS,
  TEXT_EXTENSIONS,
  extractTextFromDocx,
  parseSmartText,
  parseSpreadsheetFile,
  readPlainTextFile,
} from '@/lib/property/parse'
import { emptyProperty, propertyFields, type PropertyRecord } from '@/lib/property/types'

function extensionOf(fileName: string) {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/)
  return match?.[0] ?? ''
}

type PropertyAnalyzerProps = {
  activeAgentName: string | null
}

export function PropertyAnalyzer({ activeAgentName }: PropertyAnalyzerProps) {
  const [record, setRecord] = useState<PropertyRecord>(emptyProperty)
  const [detectedFields, setDetectedFields] = useState<string[]>([])
  const [conflictFields, setConflictFields] = useState<(keyof PropertyRecord)[]>([])
  const [smartText, setSmartText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [alternateRecords, setAlternateRecords] = useState<PropertyRecord[]>([])

  const missingFields = useMemo(
    () => propertyFields.filter((field) => field.required && !record[field.key].trim()),
    [record],
  )
  const hasExportableData = useMemo(
    () => Object.values(record).some((value) => value.trim().length > 0),
    [record],
  )
  const completionFields = [
    'code', 'type', 'category', 'price', 'size', 'beds', 'baths',
    'floor', 'finishing', 'view', 'remainingAmount', 'installmentCount',
    'installmentAmount', 'installmentFrequency', 'installmentPeriod',
  ] as const
  const completion = useMemo(() => {
    const filled = completionFields.filter((key) => record[key].trim()).length
    return Math.round((filled / completionFields.length) * 100)
  }, [record])

  function applyRecord(next: PropertyRecord, detected: string[], message: string, conflicts: (keyof PropertyRecord)[] = []) {
    setRecord(next)
    setDetectedFields(detected)
    setConflictFields(conflicts)
    setStatusMessage(message)
  }

  function handleAnalyzeText(text: string) {
    if (!text.trim()) return
    setErrorMessage('')
    const { record: parsed, detectedFields: detected, conflicts } = parseSmartText(text)
    const conflictNote = conflicts.length > 0
      ? ` تم رصد أكثر من قيمة محتملة لـ ${conflicts.length} حقل، راجعها قبل التصدير.`
      : ''
    applyRecord(parsed, detected, `تم استخراج ${detected.length} حقلًا من النص.${conflictNote} راجع الخانات وعدّل ما تحتاجه.`, conflicts)
  }

  async function handleAnalyzeWithAI(text: string) {
    if (!text.trim()) return
    setIsAiProcessing(true)
    setErrorMessage('')
    try {
      const { record: parsed, detectedFields: detected, agentName } = await analyzePropertyWithAI(text)
      applyRecord(parsed, detected, `تم استخراج ${detected.length} حقلًا بواسطة ${agentName}. راجع الخانات وعدّل ما تحتاجه.`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'تعذر التحليل بالذكاء الاصطناعي.')
    } finally {
      setIsAiProcessing(false)
    }
  }

  async function handleFile(file: File) {
    setIsProcessing(true)
    setFileName(file.name)
    setStatusMessage('')
    try {
      const extension = extensionOf(file.name)
      if (SPREADSHEET_EXTENSIONS.includes(extension)) {
        const rows = await parseSpreadsheetFile(file)
        if (!rows.length) { setStatusMessage('لم يتم العثور على بيانات في الملف.'); return }
        const [first, ...rest] = rows
        const detected = propertyFields.filter((field) => first[field.key].trim()).map((field) => field.key)
        applyRecord(first, detected, rows.length > 1
          ? `تم العثور على ${rows.length} عقارًا في الملف. يظهر أولها الآن، ويمكنك اختيار غيره أدناه.`
          : 'تم استيراد بيانات العقار من الملف بنجاح.')
        setAlternateRecords(rest)
        return
      }
      if (DOCX_EXTENSIONS.includes(extension)) {
        const text = await extractTextFromDocx(file)
        handleAnalyzeText(text)
        setAlternateRecords([])
        return
      }
      if (TEXT_EXTENSIONS.includes(extension)) {
        const text = await readPlainTextFile(file)
        handleAnalyzeText(text)
        setAlternateRecords([])
        return
      }
      setStatusMessage('صيغة الملف غير مدعومة. استخدم Excel أو CSV أو Word أو ملف نصي.')
    } catch (error) {
      console.error('[v0] Failed to process property file:', error)
      setStatusMessage('تعذر قراءة الملف. تأكد من سلامته وحاول مرة أخرى.')
    } finally {
      setIsProcessing(false)
    }
  }

  function handleFieldChange(key: keyof PropertyRecord, value: string) {
    setRecord((current) => ({ ...current, [key]: value }))
    setDetectedFields((current) => current.filter((field) => field !== key))
    setConflictFields((current) => current.filter((field) => field !== key))
  }

  function handleReset() {
    setRecord(emptyProperty)
    setDetectedFields([])
    setConflictFields([])
    setSmartText('')
    setFileName(null)
    setStatusMessage('')
    setErrorMessage('')
    setAlternateRecords([])
  }

  return (
    <main dir="rtl" className="min-h-screen bg-transparent text-foreground">
      <header className="day-header-separator fixed inset-x-0 top-0 z-40 border-b border-[var(--header-border)] bg-transparent shadow-[0_10px_28px_-18px_var(--header-glow)] backdrop-blur-2xl" style={{ backgroundImage: 'var(--header-surface)', position: 'fixed', insetInline: 0, top: 0 }}>
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/35 bg-primary/10 shadow-md ring-1 ring-primary/15">
              <Image src="/real-estate-mark-pro.png" alt="شعار محلل بيانات العقار" fill sizes="44px" className="scale-[2.35] object-cover" priority />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-black tracking-tight">محلل بيانات العقار</h1>
                <span className="hidden rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary sm:inline-flex">PRO</span>
              </div>
              <p className="mt-0.5 hidden max-w-[420px] truncate text-xs text-muted-foreground sm:block">تنظيم التفاصيل العقارية وتوزيعها في خانات جاهزة للتصدير</p>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 overflow-visible sm:w-auto sm:justify-end">
            <div className="flex shrink-0 items-center gap-1 rounded-xl border border-border/70 bg-card/55 p-1 shadow-sm">
              <ThemeToggle />
            </div>
            <Link
              href="/agents"
              className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-card/45 px-3.5 text-sm font-bold text-muted-foreground shadow-sm transition hover:border-primary/35 hover:bg-primary/10 hover:text-foreground"
            >
              <Settings size={15} />
              <span className="hidden md:inline">وكلاء الذكاء الاصطناعي</span>
              <span className="md:hidden">الوكلاء</span>
            </Link>
            <button
              type="button"
              onClick={handleReset}
              className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-card/45 px-3.5 text-sm font-bold text-muted-foreground shadow-sm transition hover:border-primary/35 hover:bg-primary/10 hover:text-foreground"
            >
              <RotateCcw size={15} />
              <span className="hidden md:inline">بدء عقار جديد</span>
              <span className="md:hidden">جديد</span>
            </button>
            <div className="shrink-0"> <ExportMenu record={record} disabled={!hasExportableData} /> </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1280px] items-start gap-6 px-4 pb-6 pt-28 sm:px-8 sm:pt-24 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-7">
        <div className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
          <IntakePanel
            onFile={handleFile}
            onAnalyzeText={handleAnalyzeText}
            onAnalyzeWithAI={handleAnalyzeWithAI}
            smartText={smartText}
            onSmartTextChange={setSmartText}
            fileName={fileName}
            onClearFile={() => setFileName(null)}
            isProcessing={isProcessing}
            isAiProcessing={isAiProcessing}
            activeAgentName={activeAgentName}
          />

          {alternateRecords.length > 0 && (
            <section className="rounded-2xl border border-border/80 bg-card/95 p-5 shadow-[0_12px_30px_-24px_color-mix(in_oklab,var(--foreground)_45%,transparent)]">
              <h3 className="mb-3 text-sm font-bold">عقارات أخرى في الملف ({alternateRecords.length})</h3>
              <div className="flex flex-col gap-2">
                {alternateRecords.map((alt, index) => (
                  <button
                    key={`${alt.title}-${index}`}
                    type="button"
                    onClick={() => {
                      const detected = propertyFields.filter((field) => alt[field.key].trim()).map((field) => field.key)
                      applyRecord(alt, detected, 'تم تحميل عقار آخر من الملف.')
                    }}
                    className="rounded-lg border border-border px-3 py-2 text-right text-xs font-medium transition hover:border-primary/50 hover:bg-muted"
                  >
                    <span className="block font-bold">{alt.title || 'بدون عنوان'}</span>
                    <span className="text-muted-foreground">{alt.price ? `${alt.price} — ` : ''}{alt.region || alt.city || ''}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-border/80 bg-card/95 p-5 shadow-[0_12px_30px_-24px_color-mix(in_oklab,var(--foreground)_45%,transparent)]">
            <div className="mb-2 flex items-center justify-between text-xs font-bold">
              <span>نسبة اكتمال البيانات</span>
              <span>{completion}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completion}%` }} />
            </div>

            {errorMessage && (
              <p className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {errorMessage}
              </p>
            )}

            {statusMessage && (
              <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs leading-5 text-foreground">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-primary" />
                {statusMessage}
              </p>
            )}

            {missingFields.length > 0 ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>حقول ناقصة: {missingFields.map((field) => field.label).join('، ')}</span>
              </div>
            ) : (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-5 text-primary">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                <span>جميع الحقول الأساسية مكتملة. يمكنك تصدير العقار.</span>
              </div>
            )}

            {conflictFields.length > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  تعارض في القيم: {conflictFields.map((key) => propertyFields.find((field) => field.key === key)?.label ?? key).join('، ')} — تم رصد أكثر من قيمة محتملة، راجعها قبل التصدير.
                </span>
              </div>
            )}
          </section>
        </div>

        <FieldsGrid
          record={record}
          detectedFields={detectedFields}
          conflictFields={conflictFields}
          onChange={handleFieldChange}
        />
      </div>
    </main>
  )
}
