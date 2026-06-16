import { Fragment, useCallback, useMemo, useState } from 'react'
import './App.css'
import { downloadCsv } from './lib/exportCsv'
import {
  getInvoiceStatus,
  groupFlags,
  hasMappingIssues,
  sortInvoices,
  summaryNote,
} from './lib/invoiceStatus'
import { parseInvoicePdf } from './lib/parseInvoicePdf'
import { processInvoice } from './lib/processInvoice'
import type { ProcessedInvoice } from './types'

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

type FilterMode = 'all' | 'issues'

function App() {
  const [invoices, setInvoices] = useState<ProcessedInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [filter, setFilter] = useState<FilterMode>('all')

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    )
    if (pdfFiles.length === 0) return

    setLoading(true)
    const results: ProcessedInvoice[] = []

    for (const file of pdfFiles) {
      try {
        const parsed = await parseInvoicePdf(file)
        results.push(processInvoice(parsed))
      } catch (err) {
        results.push({
          fileName: file.name,
          contractId: '',
          employeeName: null,
          employeeCountry: null,
          invoiceNumber: '',
          type: '',
          dueDate: '',
          status: '',
          totalDue: 0,
          invoiceDate: '',
          compensationAndPeo: 0,
          benefits: 0,
          bucket5100: 0,
          bucket5120: 0,
          bucket5130: 0,
          employeeExpenses: 0,
          totalXeroJe: 0,
          check: 0,
          codedLineItems: [],
          flags: [],
          errors: [`Failed to parse: ${err instanceof Error ? err.message : String(err)}`],
        })
      }
    }

    setInvoices((prev) => {
      const byKey = new Map(prev.map((inv) => [inv.invoiceNumber || inv.fileName, inv]))
      for (const inv of results) {
        byKey.set(inv.invoiceNumber || inv.fileName, inv)
      }
      return sortInvoices(Array.from(byKey.values()))
    })
    setLoading(false)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      void processFiles(e.dataTransfer.files)
    },
    [processFiles],
  )

  const issueCount = useMemo(
    () => invoices.filter((inv) => hasMappingIssues(inv)).length,
    [invoices],
  )

  const readyCount = useMemo(
    () => invoices.filter((inv) => getInvoiceStatus(inv) === 'ready').length,
    [invoices],
  )

  const manualCount = useMemo(
    () => invoices.filter((inv) => getInvoiceStatus(inv) === 'manual').length,
    [invoices],
  )

  const displayedInvoices = useMemo(() => {
    const sorted = sortInvoices(invoices)
    if (filter === 'issues') {
      return sorted.filter((inv) => hasMappingIssues(inv))
    }
    return sorted
  }, [invoices, filter])

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Pebl Invoice Reader</h1>
          <p className="subtitle">
            Drop Pebl invoice PDFs to build a summary table (one row per invoice, matching the
            CSV export). Expand a row to review line-item mappings while we tune the rules.
          </p>
        </div>
        {invoices.length > 0 && (
          <div className="header-actions">
            <button type="button" className="btn secondary" onClick={() => setInvoices([])}>
              Clear all
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() =>
                downloadCsv(
                  sortInvoices(invoices),
                  `pebl-invoices-${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
            >
              Export CSV
            </button>
          </div>
        )}
      </header>

      <section
        className={`dropzone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          id="file-input"
          accept=".pdf,application/pdf"
          multiple
          onChange={(e) => e.target.files && void processFiles(e.target.files)}
        />
        <label htmlFor="file-input" className="dropzone-label">
          {loading ? (
            <span>Processing invoices…</span>
          ) : (
            <>
              <span className="dropzone-title">Drop Pebl invoice PDFs here</span>
              <span className="dropzone-hint">or click to select — batch upload supported</span>
            </>
          )}
        </label>
      </section>

      {invoices.length > 0 && (
        <section className="summary-bar">
          <span>{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</span>
          <span className="stat-ready">{readyCount} ready</span>
          {manualCount > 0 && <span className="stat-manual">{manualCount} with Expensify items</span>}
          {issueCount > 0 && (
            <span className="stat-issues">{issueCount} need mapping attention</span>
          )}
          <div className="filter-toggle">
            <button
              type="button"
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Show all
            </button>
            <button
              type="button"
              className={`filter-btn ${filter === 'issues' ? 'active' : ''}`}
              onClick={() => setFilter('issues')}
              disabled={issueCount === 0}
            >
              Mapping issues only ({issueCount})
            </button>
          </div>
        </section>
      )}

      {invoices.length > 0 && (
        <section className="results">
          <h2 className="section-label">Summary — matches CSV export (one row per invoice)</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Invoice #</th>
                  <th>Employee</th>
                  <th>Contract ID</th>
                  <th>Invoice Date</th>
                  <th>Due Date</th>
                  <th>Total Due</th>
                  <th>5100</th>
                  <th>5120</th>
                  <th>5130</th>
                  <th>Expenses</th>
                  <th>Check</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {displayedInvoices.length === 0 && (
                  <tr>
                    <td colSpan={14} className="empty-filter">
                      No invoices with mapping issues — nice work.
                    </td>
                  </tr>
                )}
                {displayedInvoices.map((inv) => {
                  const key = inv.invoiceNumber || inv.fileName
                  const isExpanded = expanded === key
                  const status = getInvoiceStatus(inv)
                  const grouped = groupFlags(inv)
                  const note = summaryNote(inv)
                  const checkOk =
                    Math.abs(inv.check) < 0.01 ||
                    (inv.employeeExpenses > 0 &&
                      Math.abs(inv.check - inv.employeeExpenses) < 0.01)

                  return (
                    <Fragment key={key}>
                      <tr
                        className={
                          status === 'needs_review' || status === 'error' ? 'row-flagged' : ''
                        }
                        onClick={() => setExpanded(isExpanded ? null : key)}
                      >
                        <td className="expand-cell" title="Expand for line-item mapping detail">
                          {isExpanded ? '▼' : '▶'}
                        </td>
                        <td>{inv.invoiceNumber || '—'}</td>
                        <td>{inv.employeeName ?? <em>Unknown</em>}</td>
                        <td className="mono">{inv.contractId || '—'}</td>
                        <td>{inv.invoiceDate || '—'}</td>
                        <td>{inv.dueDate || '—'}</td>
                        <td className="num">{formatMoney(inv.totalDue)}</td>
                        <td className="num">{formatMoney(inv.bucket5100)}</td>
                        <td className="num">{formatMoney(inv.bucket5120)}</td>
                        <td className="num">{formatMoney(inv.bucket5130)}</td>
                        <td className="num">
                          {inv.employeeExpenses > 0 ? formatMoney(inv.employeeExpenses) : '—'}
                        </td>
                        <td className={`num ${checkOk ? 'ok' : 'warn'}`}>
                          {formatMoney(inv.check)}
                        </td>
                        <td>
                          {status === 'error' && <span className="badge error">Error</span>}
                          {status === 'needs_review' && (
                            <span className="badge warn">Mapping</span>
                          )}
                          {status === 'manual' && <span className="badge manual">Expensify</span>}
                          {status === 'ready' && <span className="badge ok">Ready</span>}
                        </td>
                        <td className="notes-cell">{note}</td>
                      </tr>
                      {isExpanded && (
                        <tr className="detail-row">
                          <td colSpan={14}>
                            <div className="detail-panel">
                              <h3 className="detail-heading">Line item mapping (for review)</h3>
                              <p className="detail-file">{inv.fileName}</p>

                              {(grouped.errors.length > 0 ||
                                grouped.missingRule.length > 0 ||
                                grouped.manual.length > 0 ||
                                grouped.unknownEmployee.length > 0 ||
                                grouped.checkNote) && (
                                <div className="flag-groups">
                                  {grouped.errors.length > 0 && (
                                    <div className="flag-group flag-group-error">
                                      <h4>Parse errors</h4>
                                      <ul>
                                        {grouped.errors.map((e) => (
                                          <li key={e}>{e}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {grouped.missingRule.length > 0 && (
                                    <div className="flag-group flag-group-missing">
                                      <h4>Missing mapping rules</h4>
                                      <ul>
                                        {grouped.missingRule.map((f) => (
                                          <li key={f}>{f}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {grouped.unknownEmployee.length > 0 && (
                                    <div className="flag-group flag-group-missing">
                                      <h4>Unknown employee</h4>
                                      <ul>
                                        {grouped.unknownEmployee.map((f) => (
                                          <li key={f}>{f}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {grouped.manual.length > 0 && (
                                    <div className="flag-group flag-group-manual">
                                      <h4>Manual — code in Expensify</h4>
                                      <ul>
                                        {grouped.manual.map((f) => (
                                          <li key={f}>{f}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {grouped.checkNote && (
                                    <div className="flag-group flag-group-missing">
                                      <h4>Reconciliation</h4>
                                      <ul>
                                        <li>{grouped.checkNote}</li>
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}

                              <table className="line-items">
                                <thead>
                                  <tr>
                                    <th>Service</th>
                                    <th>Description</th>
                                    <th>USD</th>
                                    <th>Xero Account</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {inv.codedLineItems.map((li, i) => (
                                    <tr
                                      key={`${li.service}-${i}`}
                                      className={
                                        li.bucket === 'needs_info'
                                          ? 'row-missing'
                                          : li.bucket === 'manual'
                                            ? 'row-manual'
                                            : ''
                                      }
                                    >
                                      <td>{li.service}</td>
                                      <td>{li.description}</td>
                                      <td className="num">{formatMoney(li.usdAmount)}</td>
                                      <td>{li.xeroAccount ?? '—'}</td>
                                      <td>
                                        {li.bucket === 'needs_info' && (
                                          <span className="badge warn">No mapping</span>
                                        )}
                                        {li.bucket === 'manual' && (
                                          <span className="badge manual">Expensify</span>
                                        )}
                                        {li.bucket !== 'needs_info' && li.bucket !== 'manual' && (
                                          <span className="badge ok">{li.bucket}</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="footer">
        <p>
          Iteration mode: expand rows to see which Pebl service items need new mapping rules.
          Employee Expense lines are expected — they are coded separately in Expensify.
        </p>
      </footer>
    </div>
  )
}

export default App
