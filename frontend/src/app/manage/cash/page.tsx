"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wallet, Plus, Minus, LockKeyhole, AlertTriangle, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@/components/internal/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/providers/auth-provider";
import {
  getCashShifts, getOpenShifts, getShiftDetail, getUnattributedCash,
  openShift, recordMovement, closeShift,
  CASH_STATIONS, type CashShift, type CashStation, type CashDirection,
} from "@/lib/data/cash";
import { formatNaira, cn } from "@/lib/utils";

const n = (v: string | number | null) => Number(v ?? 0);

export default function CashPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canOperate = hasPermission("cash", "CREATE");

  const [openDlg, setOpenDlg] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: openShifts = [] } = useQuery({ queryKey: ["cash-open"], queryFn: getOpenShifts });
  const { data: shifts = [], isLoading } = useQuery({ queryKey: ["cash-shifts"], queryFn: () => getCashShifts(30) });
  const { data: unattributed = [] } = useQuery({ queryKey: ["cash-unattributed"], queryFn: getUnattributedCash });

  const openStations = new Set(openShifts.map((s) => s.station));

  return (
    <PageShell
      title="Cash Drawer"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Cash Drawer" }]}
      actions={canOperate ? <Button onClick={() => setOpenDlg(true)}><Plus size={14} /> Open a shift</Button> : undefined}
    >
      <div className="grid gap-6">
        {unattributed.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-warn/40 bg-warn/5 px-3 py-2.5">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn" />
            <div>
              <p className="text-sm font-medium text-fg">
                {formatNaira(unattributed.reduce((s, m) => s + n(m.amount), 0))} in cash was taken with no shift open.
              </p>
              <p className="text-xs text-fg-soft">
                Open a shift before taking payment so the drawer reconciles. These {unattributed.length} payment(s) aren&apos;t tied to any count.
              </p>
            </div>
          </div>
        )}

        {/* Open drawers */}
        <Card>
          <CardHeader><CardTitle>Open drawers</CardTitle></CardHeader>
          <CardContent>
            {openShifts.length === 0 ? (
              <p className="py-6 text-center text-sm text-fg-muted">No drawers are open. Open one to start taking cash against a shift.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {openShifts.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setDetailId(s.id)}
                    className="flex items-center justify-between rounded-lg border border-line bg-brand-surface p-4 text-left transition-colors hover:border-brand-primary"
                  >
                    <div>
                      <span className="flex items-center gap-2 font-medium text-fg"><Wallet size={15} className="text-brand-primary-dark" /> {s.station}</span>
                      <span className="mt-0.5 block text-xs text-fg-muted">Opened {new Date(s.openedAt).toLocaleString("en-GB")}</span>
                    </div>
                    <span className="text-right">
                      <span className="block text-xs text-fg-muted">Float</span>
                      <span className="block font-semibold tabular-nums text-fg">{formatNaira(n(s.openingFloat))}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader><CardTitle>Recent shifts</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-8 text-center text-sm text-fg-muted"><Loader2 size={15} className="mr-2 inline animate-spin" />Loading…</p>
            ) : shifts.length === 0 ? (
              <p className="py-6 text-center text-sm text-fg-muted">No shifts yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-fg-muted">
                      <th className="pb-2 pr-3 font-medium">Station</th>
                      <th className="pb-2 pr-3 font-medium">Opened</th>
                      <th className="pb-2 pr-3 font-medium">Status</th>
                      <th className="pb-2 pr-3 text-right font-medium">Expected</th>
                      <th className="pb-2 pr-3 text-right font-medium">Counted</th>
                      <th className="pb-2 text-right font-medium">Over / Short</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((s) => (
                      <tr key={s.id} className="cursor-pointer border-b border-line/60 hover:bg-brand-surface-2" onClick={() => setDetailId(s.id)}>
                        <td className="py-2.5 pr-3 font-medium text-fg">{s.station}</td>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-fg-soft">{new Date(s.openedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td>
                        <td className="py-2.5 pr-3"><Badge tone={s.status === "OPEN" ? "success" : "neutral"}>{s.status}</Badge></td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-fg-soft">{s.expectedCash != null ? formatNaira(n(s.expectedCash)) : "—"}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-fg-soft">{s.countedCash != null ? formatNaira(n(s.countedCash)) : "—"}</td>
                        <td className="py-2.5 text-right tabular-nums">
                          {s.overShort == null ? <span className="text-fg-muted">—</span> : <OverShort value={n(s.overShort)} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {openDlg && (
        <OpenShiftDialog
          takenStations={openStations}
          onClose={() => setOpenDlg(false)}
          onOpened={() => { qc.invalidateQueries({ queryKey: ["cash-open"] }); qc.invalidateQueries({ queryKey: ["cash-shifts"] }); setOpenDlg(false); }}
        />
      )}
      {detailId && (
        <ShiftDetailDialog id={detailId} canOperate={canOperate} onClose={() => setDetailId(null)} onChanged={() => {
          qc.invalidateQueries({ queryKey: ["cash-open"] });
          qc.invalidateQueries({ queryKey: ["cash-shifts"] });
          qc.invalidateQueries({ queryKey: ["cash-unattributed"] });
        }} />
      )}
    </PageShell>
  );
}

function OverShort({ value }: { value: number }) {
  if (value === 0) return <span className="font-medium text-ok">Balanced</span>;
  const short = value < 0;
  return <span className={cn("font-medium", short ? "text-danger" : "text-warn")}>{short ? "Short " : "Over "}{formatNaira(Math.abs(value))}</span>;
}

function OpenShiftDialog({ takenStations, onClose, onOpened }: { takenStations: Set<CashStation>; onClose: () => void; onOpened: () => void }) {
  const free = CASH_STATIONS.filter((s) => !takenStations.has(s));
  const [station, setStation] = useState<CashStation | "">(free[0] ?? "");
  const [float, setFloat] = useState("");

  const open = useMutation({
    mutationFn: () => openShift(station as CashStation, Number(float || 0)),
    onSuccess: () => { toast.success("Shift opened."); onOpened(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open a drawer shift</DialogTitle>
          <DialogDescription>Count the cash already in the drawer and enter it as the opening float.</DialogDescription>
        </DialogHeader>
        {free.length === 0 ? (
          <p className="py-4 text-sm text-fg-soft">Every station already has an open shift. Close one before opening another.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label>Station</Label>
              <Select value={station} onValueChange={(v) => setStation(v as CashStation)}>
                <SelectTrigger><SelectValue placeholder="Station" /></SelectTrigger>
                <SelectContent>{free.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="float">Opening float (₦)</Label>
              <Input id="float" type="number" min="0" placeholder="0" value={float} onChange={(e) => setFloat(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => open.mutate()} disabled={!station || float === "" || open.isPending}>
            {open.isPending ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />} Open shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShiftDetailDialog({ id, canOperate, onClose, onChanged }: { id: string; canOperate: boolean; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const { data: shift, isLoading } = useQuery({ queryKey: ["cash-shift", id], queryFn: () => getShiftDetail(id) });
  const [mv, setMv] = useState({ direction: "OUT" as CashDirection, amount: "", reason: "" });
  const [count, setCount] = useState("");
  const [closing, setClosing] = useState(false);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["cash-shift", id] }); onChanged(); };

  const addMovement = useMutation({
    mutationFn: () => recordMovement(id, { direction: mv.direction, amount: Number(mv.amount), reason: mv.reason }),
    onSuccess: () => { toast.success("Recorded."); setMv({ direction: "OUT", amount: "", reason: "" }); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const close = useMutation({
    mutationFn: () => closeShift(id, Number(count)),
    onSuccess: (s) => {
      const os = n(s.overShort);
      toast.success(os === 0 ? "Drawer balanced." : os < 0 ? `Closed — short ${formatNaira(Math.abs(os))}.` : `Closed — over ${formatNaira(os)}.`);
      refresh(); onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isOpen = shift?.status === "OPEN";
  const expected = shift?.summary.expectedCash ?? 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{shift ? `${shift.station} drawer` : "Shift"}</DialogTitle>
          <DialogDescription>{shift ? `Opened ${new Date(shift.openedAt).toLocaleString("en-GB")}${shift.status === "CLOSED" && shift.closedAt ? ` · closed ${new Date(shift.closedAt).toLocaleString("en-GB")}` : ""}` : ""}</DialogDescription>
        </DialogHeader>

        {isLoading || !shift ? (
          <p className="py-8 text-center text-sm text-fg-muted"><Loader2 size={15} className="mr-2 inline animate-spin" />Loading…</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 rounded-md border border-line bg-brand-surface-2 p-3 text-center">
              <div><span className="block text-xs text-fg-muted">Float</span><span className="block font-semibold tabular-nums text-fg">{formatNaira(shift.summary.openingFloat)}</span></div>
              <div><span className="block text-xs text-fg-muted">Cash in</span><span className="block font-semibold tabular-nums text-ok">{formatNaira(shift.summary.cashIn)}</span></div>
              <div><span className="block text-xs text-fg-muted">Cash out</span><span className="block font-semibold tabular-nums text-danger">{formatNaira(shift.summary.cashOut)}</span></div>
            </div>
            <div className="flex items-center justify-between rounded-md bg-brand-primary/10 px-3 py-2">
              <span className="text-sm text-fg-soft">{isOpen ? "Expected in drawer now" : "Expected at close"}</span>
              <span className="font-semibold tabular-nums text-fg">{formatNaira(expected)}</span>
            </div>

            {!isOpen && shift.overShort != null && (
              <div className="flex items-center justify-between rounded-md border border-line px-3 py-2">
                <span className="text-sm text-fg-soft">Counted {formatNaira(n(shift.countedCash))} — result</span>
                <OverShort value={n(shift.overShort)} />
              </div>
            )}

            {/* Movements */}
            {shift.movements.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border border-line">
                <table className="w-full text-xs">
                  <tbody>
                    {shift.movements.map((m) => (
                      <tr key={m.id} className="border-b border-line/60 last:border-0">
                        <td className="py-1.5 pl-2">
                          {m.direction === "IN" ? <ArrowDownCircle size={13} className="inline text-ok" /> : <ArrowUpCircle size={13} className="inline text-danger" />}
                        </td>
                        <td className="py-1.5 px-2 text-fg-soft">{m.reason}</td>
                        <td className="py-1.5 px-2 text-fg-muted">{m.method}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-fg">{formatNaira(n(m.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isOpen && canOperate && !closing && (
              <>
                {/* Manual movement */}
                <div className="rounded-md border border-line p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-muted">Record a cash movement</p>
                  <div className="flex flex-wrap gap-2">
                    <Select value={mv.direction} onValueChange={(v) => setMv((p) => ({ ...p, direction: v as CashDirection }))}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OUT">Pay out</SelectItem>
                        <SelectItem value="IN">Take in</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" min="0" placeholder="Amount" value={mv.amount} onChange={(e) => setMv((p) => ({ ...p, amount: e.target.value }))} className="w-28" />
                    <Input placeholder="Reason (e.g. bought diesel)" value={mv.reason} onChange={(e) => setMv((p) => ({ ...p, reason: e.target.value }))} className="min-w-[140px] flex-1" />
                    <Button size="sm" variant="secondary" disabled={!mv.amount || !mv.reason || addMovement.isPending} onClick={() => addMovement.mutate()}>
                      {addMovement.isPending ? <Loader2 size={13} className="animate-spin" /> : mv.direction === "OUT" ? <Minus size={13} /> : <Plus size={13} />} Add
                    </Button>
                  </div>
                </div>
                <Button className="w-full" onClick={() => setClosing(true)}><LockKeyhole size={14} /> Close &amp; count drawer</Button>
              </>
            )}

            {isOpen && closing && (
              <div className="rounded-md border border-brand-primary/30 bg-brand-primary/5 p-3">
                <p className="mb-2 text-sm font-medium text-fg">Count the drawer</p>
                <p className="mb-3 text-xs text-fg-soft">Enter the physical cash you counted. The system expects {formatNaira(expected)} — any difference is recorded as over/short.</p>
                <div className="flex gap-2">
                  <Input type="number" min="0" placeholder="Counted cash" value={count} onChange={(e) => setCount(e.target.value)} className="flex-1" />
                  <Button disabled={count === "" || close.isPending} onClick={() => close.mutate()}>
                    {close.isPending ? <Loader2 size={14} className="animate-spin" /> : <LockKeyhole size={14} />} Close
                  </Button>
                </div>
                <button className="mt-2 text-xs text-fg-muted hover:text-fg" onClick={() => setClosing(false)}>Cancel</button>
              </div>
            )}

            {shift.notes && <p className="text-xs text-fg-muted">Note: {shift.notes}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
