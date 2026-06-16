import type { ProcessedInvoice } from '../types'
import { summaryNote } from './invoiceStatus'

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const HEADERS = [
  'File Name',
  'Contract ID',
  'Employee Name',
  'Country',
  'Invoice Number',
  'Type',
  'Due Date',
  'Status',
  'Total Due',
  'Invoice Date',
  'Compensation & PEO',
  'Benefits',
  '5100 - Compensation',
  '5120 - Benefits',
  'Employee Expenses (manual)',
  '5130 - PEO Expenses',
  'Total Xero JE',
  'Check',
  'Notes',
]

export function invoicesToCsv(invoices: ProcessedInvoice[]): string {
  const rows = invoices.map((inv) =>
    [
      inv.fileName,
      inv.contractId,
      inv.employeeName,
      inv.employeeCountry,
      inv.invoiceNumber,
      inv.type,
      inv.dueDate,
      inv.status,
      inv.totalDue.toFixed(2),
      inv.invoiceDate,
      inv.compensationAndPeo.toFixed(2),
      inv.benefits.toFixed(2),
      inv.bucket5100.toFixed(2),
      inv.bucket5120.toFixed(2),
      inv.employeeExpenses > 0 ? inv.employeeExpenses.toFixed(2) : '',
      inv.bucket5130.toFixed(2),
      inv.totalXeroJe.toFixed(2),
      inv.check.toFixed(2),
      summaryNote(inv),
    ]
      .map(escapeCsv)
      .join(','),
  )

  // UTF-8 BOM helps Excel on Mac/Windows open the file with correct encoding
  return `\uFEFF${[HEADERS.join(','), ...rows].join('\n')}`
}

export function downloadCsv(invoices: ProcessedInvoice[], filename: string): void {
  const csv = invoicesToCsv(invoices)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
