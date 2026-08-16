'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, FileJson, FileSpreadsheet, FileText, FileType } from 'lucide-react'
import { exportFormatLabels, exportProperty, type ExportFormat } from '@/lib/property/export'
import type { PropertyRecord } from '@/lib/property/types'

const FORMAT_ICONS: Record<ExportFormat, typeof FileText> = {
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  json: FileJson,
  pdf: FileText,
  docx: FileType,
}

const FORMATS: ExportFormat[] = ['xlsx', 'csv', 'json', 'pdf', 'docx']

export function ExportMenu({ record, disabled }: { record: PropertyRecord; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleExport(format: ExportFormat) {
    setBusy(format)
    try {
      await exportProperty(record, format)
    } finally {
      setBusy(null)
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download size={16} />
        تصدير العقار
        <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          {FORMATS.map((format) => {
            const Icon = FORMAT_ICONS[format]
            return (
              <button
                key={format}
                type="button"
                onClick={() => handleExport(format)}
                disabled={busy !== null}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-right text-sm font-medium transition hover:bg-muted disabled:opacity-50"
              >
                <Icon size={15} className="text-muted-foreground" />
                {busy === format ? 'جارٍ التصدير…' : exportFormatLabels[format]}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
