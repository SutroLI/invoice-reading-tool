export interface EmployeeMapping {
  contractId: string
  firstName: string
  lastName: string
  country: string
}

export interface ServiceMapping {
  peblServiceItem: string
  description: string | null
  invoiceNumber: string | null
  xeroAccount: string | null
  xeroDepartment: string | null
}

export interface LineItem {
  period: string
  service: string
  description: string
  usdAmount: number
}

export interface ParsedInvoice {
  fileName: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  contractId: string
  totalDue: number
  lineItems: LineItem[]
  rawText: string
}

export type XeroBucket = '5100' | '5120' | '5130' | 'manual' | 'needs_info'

export interface CodedLineItem extends LineItem {
  bucket: XeroBucket
  xeroAccount: string | null
  xeroDepartment: string | null
  flag?: string
}

export interface ProcessedInvoice {
  fileName: string
  contractId: string
  employeeName: string | null
  employeeCountry: string | null
  invoiceNumber: string
  type: string
  dueDate: string
  status: string
  totalDue: number
  invoiceDate: string
  compensationAndPeo: number
  benefits: number
  bucket5100: number
  bucket5120: number
  bucket5130: number
  employeeExpenses: number
  totalXeroJe: number
  check: number
  codedLineItems: CodedLineItem[]
  flags: string[]
  errors: string[]
}
