'use client'

import { useRef, useState, type DragEvent } from 'react'
import { Bot, FileSpreadsheet, FileText, Loader2, Sparkles, UploadCloud, X } from 'lucide-react'
import Link from 'next/link'
import { SUPPORTED_EXTENSIONS } from '@/lib/property/parse'

type IntakePanelProps = {
  onFile: (file: File) => void
  onAnalyzeText: (text: string) => void
  onAnalyzeWithAI: (text: string) => void
  smartText: string
  onSmartTextChange: (value: string) => void
  fileName: string | null
  onClearFile: () => void
  isProcessing: boolean
  isAiProcessing: boolean
  activeAgentName: string | null
}

export function IntakePanel({
  onFile,
  onAnalyzeText,
  onAnalyzeWithAI,
  smartText,
  onSmartTextChange,
  fileName,
  onClearFile,
  isProcessing,
  isAiProcessing,
  activeAgentName,
}: IntakePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const smartTextRef = useRef<HTMLTextAreaElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-border/80 bg-card/95 p-5 shadow-[0_12px_30px_-24px_color-mix(in_oklab,var(--foreground)_45%,transparent)] sm:p-6">
        <header className="mb-4 flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UploadCloud size={17} strokeWidth={2.2} />
          </span>
          <div>
            <h2 className="text-sm font-bold">رفع ملف العقار</h2>
            <p className="text-xs text-muted-foreground">CSV أو ملف نصي</p>
          </div>
        </header>

        <div
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click() }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40'
          }`}
        >
          <FileSpreadsheet size={26} strokeWidth={1.8} className="text-muted-foreground" />
          <p className="text-sm font-semibold">اسحب الملف هنا أو اضغط للاختيار</p>
          <p className="text-xs text-muted-foreground">{SUPPORTED_EXTENSIONS.join(' · ')}</p>
          <input
            ref={inputRef}
            type="file"
            accept={SUPPORTED_EXTENSIONS.join(',')}
            className="hidden"
            onChange={async (event) => {
              const input = event.target
              const file = input.files?.[0]
              if (file) await onFile(file)
              input.value = ''
            }}
          />
        </div>

        {fileName && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <FileText size={14} />
              {fileName}
            </span>
            <button type="button" onClick={onClearFile} className="text-muted-foreground hover:text-foreground" aria-label="إزالة الملف">
              <X size={14} />
            </button>
          </div>
        )}
        {isProcessing && <p className="mt-3 text-xs font-medium text-primary">جارٍ تحليل الملف…</p>}
      </section>

      <section className="rounded-2xl border border-border/80 bg-card/95 p-5 shadow-[0_12px_30px_-24px_color-mix(in_oklab,var(--foreground)_45%,transparent)] sm:p-6">
        <header className="mb-4 flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent/15 text-accent-foreground">
            <Sparkles size={17} strokeWidth={2.2} />
          </span>
          <div>
            <h2 className="text-sm font-bold">أو الصق التفاصيل غير المرتبة</h2>
            <p className="text-xs text-muted-foreground">سيقوم المحلل باستخراج الحقول تلقائيًا</p>
          </div>
        </header>
        <textarea
          ref={smartTextRef}
          value={smartText}
          onChange={(event) => onSmartTextChange(event.target.value)}
          placeholder="مثال: شقة 180 متر بالتجمع الخامس، 3 غرف وحمامين، السعر 1,850,000، فيو مفتوح، تشطيب سوبر لوكس..."
          rows={7}
          className="w-full resize-none rounded-xl border border-input bg-background px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onAnalyzeText(smartTextRef.current?.value ?? smartText)}
            disabled={isProcessing || isAiProcessing}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-border text-sm font-bold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles size={16} />
            تحليل سريع
          </button>
          <button
            type="button"
            onClick={() => onAnalyzeWithAI(smartText)}
            disabled={!smartText.trim() || isProcessing || isAiProcessing}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isAiProcessing ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
            تحليل ذكي بالـ AI
          </button>
        </div>

        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          {activeAgentName ? (
            <>الوكيل النشط: <span className="font-bold text-foreground">{activeAgentName}</span></>
          ) : (
            <>
              لا يوجد وكيل ذكاء اصطناعي مُفعّل حاليًا.{' '}
              <Link href="/agents" className="font-bold text-primary hover:underline">
                إضافة وكيل من الإعدادات
              </Link>
            </>
          )}
        </p>
      </section>
    </div>
  )
}
