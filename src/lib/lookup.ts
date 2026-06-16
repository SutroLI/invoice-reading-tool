import type {
  CodedLineItem,
  EmployeeMapping,
  LineItem,
  ServiceMapping,
  XeroBucket,
} from '../types'

const MANUAL_ACCOUNT = 'Depends on Expensify Reports'

function accountToBucket(account: string | null): XeroBucket {
  if (!account || account === MANUAL_ACCOUNT) return 'manual'
  if (account.startsWith('5100')) return '5100'
  if (account.startsWith('5120')) return '5120'
  if (account.startsWith('5130')) return '5130'
  return 'needs_info'
}

function ruleSpecificity(rule: ServiceMapping): number {
  let score = 0
  if (rule.description) score += 2
  if (rule.invoiceNumber) score += 4
  return score
}

function ruleMatches(
  rule: ServiceMapping,
  item: LineItem,
  contractId: string,
  invoiceNumber: string,
): boolean {
  if (rule.peblServiceItem.toLowerCase() !== item.service.toLowerCase()) {
    return false
  }

  if (rule.invoiceNumber && rule.invoiceNumber !== invoiceNumber) return false

  if (rule.description) {
    const desc = rule.description
    const isContractId = /^D5170-/.test(desc)
    if (isContractId) {
      if (desc !== contractId) return false
    } else if (!item.description.toLowerCase().includes(desc.toLowerCase())) {
      return false
    }
  }

  return true
}

export function lookupEmployee(
  contractId: string,
  employees: EmployeeMapping[],
): EmployeeMapping | null {
  return employees.find((e) => e.contractId === contractId) ?? null
}

export function codeLineItem(
  item: LineItem,
  contractId: string,
  invoiceNumber: string,
  services: ServiceMapping[],
): CodedLineItem {
  if (item.service === 'Employee Expense') {
    return {
      ...item,
      bucket: 'manual',
      xeroAccount: MANUAL_ACCOUNT,
      xeroDepartment: MANUAL_ACCOUNT,
      flag: 'Code via Expensify — excluded from auto-totals',
    }
  }

  const matches = services
    .filter((rule) => ruleMatches(rule, item, contractId, invoiceNumber))
    .sort((a, b) => ruleSpecificity(b) - ruleSpecificity(a))

  const best = matches[0]

  if (!best || !best.xeroAccount) {
    return {
      ...item,
      bucket: 'needs_info',
      xeroAccount: null,
      xeroDepartment: null,
      flag: `No mapping for "${item.service}"${item.description ? ` (${item.description})` : ''}`,
    }
  }

  const bucket = accountToBucket(best.xeroAccount)

  return {
    ...item,
    bucket,
    xeroAccount: best.xeroAccount,
    xeroDepartment: best.xeroDepartment,
    flag:
      bucket === 'manual'
        ? 'Code via Expensify — excluded from auto-totals'
        : undefined,
  }
}
