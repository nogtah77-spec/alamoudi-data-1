import * as XLSX from 'xlsx'
import { propertyFields, sectionLabels, type PropertyRecord } from './types'

export type ExportFormat = 'xlsx' | 'csv' | 'json' | 'docx'

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

function exportXlsx(record: PropertyRecord) {
  const row = buildLabeledRow(record)
  const sheet = XLSX.utils.json_to_sheet([row])
  sheet['!cols'] = Object.keys(row).map(() => ({ wch: 28 }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'تفاصيل العقار')
  XLSX.writeFile(workbook, `${baseFilename(record)}.xlsx`)
}

function exportCsv(record: PropertyRecord) {
  const row = buildLabeledRow(record)
  const escapeCsv = (value: string) => `"${value.replaceAll('"', '""')}"`
  const header = Object.keys(row).map(escapeCsv).join(',')
  const values = Object.values(row).map(escapeCsv).join(',')
  const csv = `\uFEFF${header}\r\n${values}\r\n`
  triggerDownload(
    new File([csv], `${baseFilename(record)}.csv`, { type: 'text/csv;charset=utf-8' }),
    `${baseFilename(record)}.csv`,
  )
}

function exportJson(record: PropertyRecord) {
  const payload = { ...buildLabeledRow(record), exportedAt: new Date().toISOString() }
  triggerDownload(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }),
    `${baseFilename(record)}.json`,
  )
}

async function exportDocx(record: PropertyRecord) {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx')
  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({ text: record.title || 'تفاصيل العقار', heading: HeadingLevel.TITLE, alignment: 'right' }),
  ]
  if (record.code) {
    children.push(new Paragraph({ children: [new TextRun({ text: `كود العقار: ${record.code}`, color: '666666' })], alignment: 'right' }))
  }

  const sections = ['basic', 'details', 'location', 'source', 'media'] as const
  for (const section of sections) {
    const fields = propertyFields.filter((field) => field.section === section && record[field.key])
    if (!fields.length) continue
    children.push(new Paragraph({ text: sectionLabels[section], heading: HeadingLevel.HEADING_2, alignment: 'right' }))
    for (const field of fields) {
      children.push(
        new Paragraph({
          alignment: 'right',
          children: [
            new TextRun({ text: `${field.label}: `, bold: true }),
            new TextRun({ text: String(record[field.key]) }),
          ],
        }),
      )
    }
  }

  const doc = new Document({ sections: [{ properties: {}, children }] })
  const blob = await Packer.toBlob(doc)
  triggerDownload(blob, `${baseFilename(record)}.docx`)
}

export async function exportProperty(record: PropertyRecord, format: ExportFormat) {
  if (format === 'xlsx') return exportXlsx(record)
  if (format === 'csv') return exportCsv(record)
  if (format === 'json') return exportJson(record)
  return exportDocx(record)
}

export const exportFormatLabels: Record<ExportFormat, string> = {
  xlsx: 'Excel (.xlsx)',
  csv: 'CSV (.csv)',
  json: 'JSON (.json)',
  docx: 'Word (.docx)',
}
