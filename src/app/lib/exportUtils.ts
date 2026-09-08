// src/lib/exportUtils.ts
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────
export function exportToCSV(data: object[], filename: string) {
  const csv = Papa.unparse(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename + '.csv')

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────
// EXCEL EXPORT
// ──��──────────────────────────────────────
export function exportToExcel(data: object[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')

  const cols = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.max(key.length, 15),
  }))

  worksheet['!cols'] = cols

  XLSX.writeFile(workbook, filename + '.xlsx')
}

// ─────────────────────────────────────────
// PDF EXPORT
// ─────────────────────────────────────────
export function exportToPDF(
  columns: string[],
  rows: (string | number)[][],
  filename: string,
  title: string
) {
  const doc = new jsPDF()

  doc.setFontSize(16)
  doc.setTextColor(40, 40, 40)
  doc.text(title, 14, 20)

  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text('Generated: ' + new Date().toLocaleString(), 14, 28)

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: 35,
    styles: { fontSize: 9 },
    headStyles: {
      fillColor: [24, 144, 255],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  })

  doc.save(filename + '.pdf')
}

// ──────────────────────────────────────��──
// CSV TEMPLATE DOWNLOAD
// ─────────────────────────────────────────
export function downloadCSVTemplate(headers: string[], filename: string) {
  const csv = headers.join(',') + '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename + '_template.csv')

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────
// EXCEL TEMPLATE DOWNLOAD
// ─────────────────────────────────────────
export function downloadExcelTemplate(headers: string[], filename: string) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers])
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template')

  const cols = headers.map((h) => ({
    wch: Math.max(h.length, 18),
  }))

  worksheet['!cols'] = cols

  XLSX.writeFile(workbook, filename + '_template.xlsx')
}