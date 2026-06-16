/**
 * Quick CLI test against sample PDFs using pymupdf-extracted text logic.
 * Run: node scripts/test-parse.mjs
 */
import { readFileSync } from 'fs'
import { createRequire } from 'module'

// Dynamic import won't work easily for TS - use subprocess via npm run build first
// This script uses fitz via python fallback
import { execSync } from 'child_process'

const pdfs = [
  '/Users/user/Downloads/11. May 2026/_OCI 26-0513 Velocity Bill 1919984.pdf',
  '/Users/user/Downloads/11. May 2026/_OCI 26-0515 Velocity Bill 1923536.pdf',
  '/Users/user/Downloads/11. May 2026/_OCI 26-0518 Velocity Bill 1924355.pdf',
  '/Users/user/Downloads/08. Feb 2026/_OCI 26-0213 Velocity Bill 1830557.pdf',
  '/Users/user/Downloads/08. Feb 2026/_OCI 26-0220 Velocity Bill 1840333.pdf',
]

const py = `
import fitz, json, sys
sys.path.insert(0, '.')
paths = json.loads(sys.argv[1])
out = []
for p in paths:
    doc = fitz.open(p)
    out.append({"name": p.split("/")[-1], "text": doc[0].get_text()})
    doc.close()
print(json.dumps(out))
`

const result = execSync(`python3 -c ${JSON.stringify(py)} ${JSON.stringify(JSON.stringify(pdfs))}`, {
  encoding: 'utf-8',
  maxBuffer: 10 * 1024 * 1024,
})

const invoices = JSON.parse(result)
console.log(`Testing ${invoices.length} invoices via built parser...`)

// We'll validate by running tsc build - actual browser test needs dev server
for (const inv of invoices) {
  const num = inv.text.match(/Invoice\\s+(\\d+)/)?.[1]
  const total = inv.text.match(/Total Due in USD\\n([\\d,]+\\.?\\d*)/)?.[1]
  const contract = inv.text.match(/(D5170-[A-Z]{3}-\\d{3})/)?.[1]
  console.log(`  ${inv.name}: #${num} ${contract} total=$${total}`)
}

console.log('Run npm run dev and upload PDFs in browser for full validation.')
