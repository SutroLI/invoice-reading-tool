# Pebl Invoice Reader

Static web app for Oil Change International to extract data from Pebl (formerly Velocity Global) invoices, apply employee and service-to-Xero mappings, and export a spreadsheet for accounting.

Hosted on GitHub Pages at: `https://sutroli.github.io/invoice-reading-tool/`

## Features

- Batch upload of Pebl invoice PDFs (drag-and-drop or file picker)
- Extracts header fields and line items from invoice PDFs
- Looks up employee names from contract IDs
- Maps service line items to Xero account buckets (5100, 5120, 5130)
- Flags unmapped items (e.g. Meal Allowance) and Employee Expense lines for manual review
- Exports results as CSV

## Development

```bash
npm install
npm run dev
```

## Build for GitHub Pages

```bash
npm run build:pages
```

## Updating mappings

Employee and service mappings are in `src/data/mappings.json`, generated from the finance team's Excel workbook. To refresh:

1. Update the Excel file
2. Re-run the conversion script (or edit `mappings.json` directly)
3. Rebuild and deploy

## Deployment

Pushes to `main` automatically deploy via GitHub Actions. Enable GitHub Pages in repo settings with source **GitHub Actions**.
