import type { CompanyInvoice } from "@/lib/data/companies";

const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);

/**
 * Opens a print-optimised invoice in a new window and triggers the print dialog
 * (Save as PDF). Zero-dependency — the browser handles PDF generation.
 */
export function printCompanyInvoice(inv: CompanyInvoice) {
  const today = new Date().toLocaleDateString();
  const deptRows = inv.byDepartment
    .map((d) => `<tr><td style="text-transform:capitalize">${esc(d.department.toLowerCase())}</td><td class="r">${naira(d.amount)}</td></tr>`)
    .join("");
  const guestBlocks = inv.byGuest
    .map((g) => {
      const lines = g.charges
        .map((c) => `<tr><td>${esc(c.date?.slice(0, 10) ?? "")}</td><td style="text-transform:capitalize">${esc(c.department.toLowerCase())}</td><td>${esc(c.description)}${c.room ? ` · Rm ${esc(c.room)}` : ""}</td><td class="r">${naira(c.amount + c.tax)}</td></tr>`)
        .join("");
      return `<h3>${esc(g.guestName)} <span class="muted">— ${naira(g.total)}</span></h3>
        <table class="lines"><thead><tr><th>Date</th><th>Dept</th><th>Description</th><th class="r">Amount</th></tr></thead><tbody>${lines}</tbody></table>`;
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice — ${esc(inv.company.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #211d18; margin: 40px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #c9a84c; padding-bottom: 16px; }
    .brand { font-size: 22px; font-weight: 700; letter-spacing: .06em; }
    .doc { text-align: right; }
    .doc h1 { margin: 0; font-size: 20px; letter-spacing: .1em; }
    .muted { color: #928a7c; font-weight: 400; }
    h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #928a7c; margin: 24px 0 6px; }
    h3 { font-size: 14px; margin: 18px 0 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e6dfd3; }
    th { color: #928a7c; font-weight: 600; font-size: 11px; text-transform: uppercase; }
    .r { text-align: right; }
    .totals { margin-top: 24px; margin-left: auto; width: 280px; }
    .totals td { border: 0; padding: 4px 8px; }
    .totals .grand { font-size: 16px; font-weight: 700; border-top: 2px solid #211d18; }
    .out { color: #a3341f; font-weight: 600; }
    @media print { body { margin: 16px; } }
  </style></head><body>
    <div class="head">
      <div>
        <div class="brand">ACEMCO EXPRESS</div>
        <div class="muted" style="font-size:12px">Warri, Delta State, Nigeria</div>
      </div>
      <div class="doc">
        <h1>INVOICE</h1>
        <div class="muted" style="font-size:12px">${today}</div>
      </div>
    </div>
    <h2>Billed to</h2>
    <div><strong>${esc(inv.company.name)}</strong> <span class="muted">(${esc(inv.company.tier.toLowerCase())})</span></div>
    ${inv.company.billingEmail ? `<div class="muted" style="font-size:12px">${esc(inv.company.billingEmail)}</div>` : ""}

    <h2>Summary by department</h2>
    <table><tbody>${deptRows}</tbody></table>

    <h2>Detail by guest</h2>
    ${guestBlocks || '<p class="muted">No charges.</p>'}

    <table class="totals">
      <tr><td>Tax included</td><td class="r">${naira(inv.taxTotal)}</td></tr>
      <tr class="grand"><td>Total</td><td class="r">${naira(inv.grandTotal)}</td></tr>
      <tr><td>Outstanding</td><td class="r out">${naira(inv.outstanding)}</td></tr>
    </table>
  </body></html>`;

  const w = window.open("", "_blank", "width=800,height=1000");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}
