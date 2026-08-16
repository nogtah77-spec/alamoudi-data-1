import { propertyFields, type PropertyRecord } from './types'

export type ExportFormat = 'csv' | 'json'

function buildLabeledRow(record: PropertyRecord): Record<string, string> {
  const row: Record<string, string> = {}
  for (const field of propertyFields) row[field.label] = record[field.key] ?? ''
  return row
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  window.setTimeout(() => {
    link.remove()
    URL.revokeObjectURL(url)
  }, 1000)
}

function baseFilename(record: PropertyRecord) {
  return (record.code || record.title || 'عقار')
    .replace(/\.(?:xlsx|xls|csv|json|docx)$/i, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim() || 'عقار'
}

function exportCsv(record: PropertyRecord) {
  const row = buildLabeledRow(record)
  const escapeCsv = (value: string) => `"${value.replaceAll('"', '""')}"`
  const header = Object.keys(row).map(escapeCsv).join(',')
  const values = Object.values(row).map(escapeCsv).join(',')
  const csv = `\uFEFF${header}\r\n${values}\r\n`
  const filename = `${baseFilename(record)}.csv`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.setAttribute('download', filename)
  link.type = 'text/csv'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function exportJson(record: PropertyRecord) {
  const payload = { ...buildLabeledRow(record), exportedAt: new Date().toISOString() }
  triggerDownload(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }),
    `${baseFilename(record)}.json`,
  )
}

export async function exportProperty(record: PropertyRecord, format: ExportFormat) {
  if (format === 'csv') return exportCsv(record)
  return exportJson(record)
}

export const exportFormatLabels: Record<ExportFormat, string> = {
  csv: 'CSV (.csv)',
  json: 'JSON (.json)',
}
