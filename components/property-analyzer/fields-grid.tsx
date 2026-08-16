'use client'

import { AlertTriangle, BadgeCheck } from 'lucide-react'
import { propertyFields, sectionLabels, type PropertyRecord } from '@/lib/property/types'

type FieldsGridProps = {
  record: PropertyRecord
  detectedFields: string[]
  conflictFields?: (keyof PropertyRecord)[]
  onChange: (key: keyof PropertyRecord, value: string) => void
}

const SECTIONS = ['basic', 'location', 'details', 'source', 'media'] as const

function formatPrice(value: string) {
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('en-US')
}

export function FieldsGrid({ record, detectedFields, conflictFields = [], onChange }: FieldsGridProps) {
  return (
    <div className="flex flex-col gap-6">
      {SECTIONS.map((section) => {
        const fields = propertyFields.filter((field) => field.section === section)
        return (
          <section key={section} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h3 className="mb-4 text-sm font-bold text-foreground">{sectionLabels[section]}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => {
                const isDetected = detectedFields.includes(field.key)
                const isConflicted = conflictFields.includes(field.key)
                const isTextarea = field.kind === 'textarea'
                return (
                  <label key={field.key} className={`flex flex-col gap-1.5 text-xs font-bold text-foreground ${isTextarea ? 'sm:col-span-2' : ''}`}>
                    <span className="flex items-center gap-1.5">
                      {field.label}
                      {field.required && <span className="text-destructive">*</span>}
                      {field.hint && (
                        <span className="text-[10px] font-normal text-muted-foreground">({field.hint})</span>
                      )}
                      {isDetected && !isConflicted && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          <BadgeCheck size={12} strokeWidth={2.5} aria-label="مستخرج" />
                        </span>
                      )}
                      {isConflicted && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive"
                          title="تم رصد أكثر من قيمة محتملة لهذا الحقل في النص. القيمة المعروضة هي أول قيمة عُثر عليها فقط."
                        >
                          <AlertTriangle size={10} />
                          تعارض
                        </span>
                      )}
                    </span>

                    {field.kind === 'select' ? (
                      <select
                        value={record[field.key]}
                        onChange={(event) => onChange(field.key, event.target.value)}
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                      >
                        <option value="">— اختر —</option>
                        {field.options?.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : isTextarea ? (
                      <textarea
                        value={record[field.key]}
                        onChange={(event) => onChange(field.key, event.target.value)}
                        placeholder={field.placeholder}
                        rows={3}
                        className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal leading-6 outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                      />
                    ) : (
                      <input
                        type={field.kind === 'number' ? 'text' : 'text'}
                        inputMode={field.kind === 'number' ? 'numeric' : undefined}
                        value={record[field.key]}
                        onChange={(event) => onChange(field.key, field.key === 'price' ? formatPrice(event.target.value) : event.target.value)}
                        placeholder={field.placeholder}
                        className={`h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal outline-none transition focus:ring-2 ${
                          isConflicted
                            ? 'border-destructive/40 focus:border-destructive focus:ring-destructive/20'
                            : 'border-input focus:border-ring focus:ring-ring/20'
                        }`}
                      />
                    )}
                    {isConflicted && (
                      <span className="text-[10px] font-normal leading-4 text-destructive">
                        تم العثور على أكثر من قيمة محتملة في النص، تحقق من صحة الرقم قبل الحفظ.
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
