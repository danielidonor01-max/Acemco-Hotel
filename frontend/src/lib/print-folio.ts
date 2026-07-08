const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;
const esc = (s: string) => (s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);

export interface FolioHeader {
  guestName: string;
  reservationNumber: string;
  roomType?: string | null;
  room?: string | null;
  checkIn: string;
  checkOut: string;
  company?: string | null;
  status?: string;
}
export interface FolioLinePrint {
  description: string;
  amount: number;
  type: string;
  postedAt?: string;
}

/** Print-optimised guest folio (browser Save-as-PDF). Zero-dependency. */
export function printGuestFolio(h: FolioHeader, lines: FolioLinePrint[], balance: number) {
  const rows = lines
    .map((l) => `<tr><td style="text-transform:capitalize">${esc(l.type.toLowerCase())}</td><td>${esc(l.description)}</td><td class="r">${naira(l.amount)}</td></tr>`)
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Folio — ${esc(h.guestName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #211d18; margin: 40px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #c9a84c; padding-bottom: 16px; }
    .brand { font-size: 22px; font-weight: 700; letter-spacing: .06em; }
    .doc { text-align: right; }
    .doc h1 { margin: 0; font-size: 20px; letter-spacing: .1em; }
    .muted { color: #928a7c; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 20px 0; font-size: 13px; }
    .meta .k { color: #928a7c; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e6dfd3; }
    th { color: #928a7c; font-weight: 600; font-size: 11px; text-transform: uppercase; }
    .r { text-align: right; }
    .total { margin-top: 20px; margin-left: auto; width: 260px; font-size: 16px; font-weight: 700; display: flex; justify-content: space-between; border-top: 2px solid #211d18; padding-top: 8px; }
    @media print { body { margin: 16px; } }
  </style></head><body>
    <div class="head">
      <div>
        <div class="brand">ACEMCO EXPRESS</div>
        <div class="muted" style="font-size:12px">Warri, Delta State, Nigeria</div>
      </div>
      <div class="doc"><h1>GUEST FOLIO</h1><div class="muted" style="font-size:12px">${esc(h.reservationNumber)}</div></div>
    </div>
    <div class="meta">
      <div><span class="k">Guest:</span> <strong>${esc(h.guestName)}</strong></div>
      <div><span class="k">Room:</span> ${esc(h.roomType ?? "—")}${h.room ? ` · ${esc(h.room)}` : ""}</div>
      <div><span class="k">Check-in:</span> ${esc(h.checkIn?.slice(0, 10))}</div>
      <div><span class="k">Check-out:</span> ${esc(h.checkOut?.slice(0, 10))}</div>
      ${h.company ? `<div><span class="k">Company:</span> ${esc(h.company)}</div>` : ""}
      ${h.status ? `<div><span class="k">Status:</span> <span style="text-transform:capitalize">${esc(h.status.toLowerCase())}</span></div>` : ""}
    </div>
    <table><thead><tr><th>Dept</th><th>Description</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3" class="muted">No charges.</td></tr>'}</tbody></table>
    <div class="total"><span>Balance</span><span>${naira(balance)}</span></div>
  </body></html>`;

  const w = window.open("", "_blank", "width=800,height=1000");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

/** Print-optimised guest checkout receipt — the settled folio marked PAID. Zero-dependency. */
export function printGuestReceipt(h: FolioHeader, lines: FolioLinePrint[], total: number, paymentMethod?: string) {
  const issued = new Date().toLocaleDateString();
  const receiptNo = `RCP-${esc(h.reservationNumber).replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase()}`;
  const rows = lines
    .map((l) => `<tr><td style="text-transform:capitalize">${esc(l.type.toLowerCase())}</td><td>${esc(l.description)}</td><td class="r">${naira(l.amount)}</td></tr>`)
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt — ${esc(h.guestName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #211d18; margin: 40px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #c9a84c; padding-bottom: 16px; }
    .brand { font-size: 22px; font-weight: 700; letter-spacing: .06em; }
    .doc { text-align: right; }
    .doc h1 { margin: 0; font-size: 20px; letter-spacing: .1em; }
    .paid { display: inline-block; margin-top: 6px; padding: 2px 10px; border: 2px solid #2e7d32; color: #2e7d32; border-radius: 6px; font-weight: 700; letter-spacing: .1em; font-size: 12px; }
    .muted { color: #928a7c; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 20px 0; font-size: 13px; }
    .meta .k { color: #928a7c; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e6dfd3; }
    th { color: #928a7c; font-weight: 600; font-size: 11px; text-transform: uppercase; }
    .r { text-align: right; }
    .total { margin-top: 20px; margin-left: auto; width: 280px; font-size: 18px; font-weight: 700; display: flex; justify-content: space-between; border-top: 2px solid #211d18; padding-top: 8px; }
    .thanks { margin-top: 28px; font-size: 13px; color: #928a7c; }
    @media print { body { margin: 16px; } }
  </style></head><body>
    <div class="head">
      <div>
        <div class="brand">ACEMCO EXPRESS</div>
        <div class="muted" style="font-size:12px">Warri, Delta State, Nigeria</div>
      </div>
      <div class="doc"><h1>RECEIPT</h1><div class="muted" style="font-size:12px">${receiptNo} · ${issued}</div><div class="paid">PAID</div></div>
    </div>
    <div class="meta">
      <div><span class="k">Guest:</span> <strong>${esc(h.guestName)}</strong></div>
      <div><span class="k">Room:</span> ${esc(h.roomType ?? "—")}${h.room ? ` · ${esc(h.room)}` : ""}</div>
      <div><span class="k">Check-in:</span> ${esc(h.checkIn?.slice(0, 10))}</div>
      <div><span class="k">Check-out:</span> ${esc(h.checkOut?.slice(0, 10))}</div>
      ${h.company ? `<div><span class="k">Company:</span> ${esc(h.company)}</div>` : ""}
      ${paymentMethod ? `<div><span class="k">Paid by:</span> <span style="text-transform:capitalize">${esc(paymentMethod.toLowerCase())}</span></div>` : ""}
    </div>
    <table><thead><tr><th>Dept</th><th>Description</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3" class="muted">No charges.</td></tr>'}</tbody></table>
    <div class="total"><span>Total paid</span><span>${naira(total)}</span></div>
    <p class="thanks">Thank you for staying with Acemco Express. This receipt is valid without a signature.</p>
  </body></html>`;

  const w = window.open("", "_blank", "width=800,height=1000");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}
