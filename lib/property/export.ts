import * as XLSX from 'xlsx'
import { propertyFields, sectionLabels, type PropertyRecord } from './types'

export type ExportFormat = 'xlsx' | 'csv' | 'json' | 'pdf' | 'docx'

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
  link.click()
  URL.revokeObjectURL(url)
}

function baseFilename(record: PropertyRecord) {
  return (record.code || record.title || 'عقار').replace(/[\\/:*?"<>|]/g, '-').trim() || 'عقار'
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
  const header = Object.keys(row).join(',')
  const values = Object.values(row).map((value) => `"${value.replaceAll('"', '""')}"`).join(',')
  const csv = `\uFEFF${header}\n${values}`
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${baseFilename(record)}.csv`)
}

function exportJson(record: PropertyRecord) {
  const payload = { ...buildLabeledRow(record), exportedAt: new Date().toISOString() }
  triggerDownload(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }),
    `${baseFilename(record)}.json`,
  )
}

async function exportPdf(record: PropertyRecord) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const marginX = 48
  let y = 56

  doc.setFontSize(18)
  doc.text(record.title || 'تفاصيل العقار', marginX, y)
  y += 28
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(record.code ? `كود العقار: ${record.code}` : ' ', marginX, y)
  y += 24
  doc.setTextColor(20)

  const sections = ['basic', 'details', 'location', 'source', 'media'] as const
  for (const section of sections) {
    const fields = propertyFields.filter((field) => field.section === section && record[field.key])
    if (!fields.length) continue

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(sectionLabels[section], marginX, y)
    y += 18
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)

    for (const field of fields) {
      const value = String(record[field.key])
      const lines = doc.splitTextToSize(`${field.label}: ${value}`, 500)
      if (y + lines.length * 14 > 780) { doc.addPage(); y = 56 }
      doc.text(lines, marginX, y)
      y += lines.length * 14 + 4
    }
    y += 10
  }

  doc.save(`${baseFilename(record)}.pdf`)
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
  if (format === 'pdf') return exportPdf(record)
  return exportDocx(record)
}

export const exportFormatLabels: Record<ExportFormat, string> = {
  xlsx: 'Excel (.xlsx)',
  csv: 'CSV (.csv)',
  json: 'JSON (.json)',
  pdf: 'PDF (.pdf)',
  docx: 'Word (.docx)',
}
