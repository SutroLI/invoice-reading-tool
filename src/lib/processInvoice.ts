import mappings from '../data/mappings.json'
import type {
  EmployeeMapping,
  ParsedInvoice,
  ProcessedInvoice,
  ServiceMapping,
} from '../types'
import { codeLineItem, lookupEmployee } from './lookup'

const employees = mappings.employees as EmployeeMapping[]
const services = mappings.services as ServiceMapping[]

function inferType(lineItems: ParsedInvoice['lineItems']): string {
  const services = lineItems.map((li) => li.service)
  if (services.some((s) => /compensation/i.test(s))) return 'Compensation'
  return services[0] ?? 'Compensation'
}

export function processInvoice(parsed: ParsedInvoice): ProcessedInvoice {
  const errors: string[] = []
  const flags: string[] = []

  if (!parsed.invoiceNumber) errors.push('Could not extract invoice number')
  if (!parsed.contractId) errors.push('Could not extract contract ID')
  if (parsed.lineItems.length === 0) errors.push('No line items found')

  const employee = parsed.contractId
    ? lookupEmployee(parsed.contractId, employees)
    : null

  if (parsed.contractId && !employee) {
    flags.push(`Unknown contract ID: ${parsed.contractId}`)
  }

  const codedLineItems = parsed.lineItems.map((item) =>
    codeLineItem(item, parsed.contractId, parsed.invoiceNumber, services),
  )

  for (const item of codedLineItems) {
    if (item.flag && !flags.includes(item.flag)) flags.push(item.flag)
  }

  const bucket5100 = sumBucket(codedLineItems, '5100')
  const bucket5120 = sumBucket(codedLineItems, '5120')
  const bucket5130 = sumBucket(codedLineItems, '5130')
  const employeeExpenses = sumBucket(codedLineItems, 'manual')
  const needsInfo = codedLineItems.filter((li) => li.bucket === 'needs_info')

  if (needsInfo.length > 0) {
    flags.push(
      `${needsInfo.length} line item(s) need mapping review: ${needsInfo.map((li) => li.service).join(', ')}`,
    )
  }

  const totalXeroJe = bucket5100 + bucket5120 + bucket5130
  // Non-zero check usually means manual lines (e.g. Employee Expense) still on the invoice
  const check = round2(parsed.totalDue - totalXeroJe)

  return {
    fileName: parsed.fileName,
    contractId: parsed.contractId,
    employeeName: employee ? `${employee.firstName} ${employee.lastName}` : null,
    employeeCountry: employee?.country ?? null,
    invoiceNumber: parsed.invoiceNumber,
    type: inferType(parsed.lineItems),
    dueDate: parsed.dueDate,
    status: 'Paid In Full',
    totalDue: parsed.totalDue,
    invoiceDate: parsed.invoiceDate,
    compensationAndPeo: round2(bucket5100 + bucket5130),
    benefits: round2(bucket5120),
    bucket5100,
    bucket5120,
    bucket5130,
    employeeExpenses,
    totalXeroJe,
    check,
    codedLineItems,
    flags,
    errors,
  }
}

function sumBucket(
  items: { bucket: string; usdAmount: number }[],
  bucket: string,
): number {
  return round2(
    items
      .filter((li) => li.bucket === bucket)
      .reduce((sum, li) => sum + li.usdAmount, 0),
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
