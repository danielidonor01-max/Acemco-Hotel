"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Card, Badge, EmptyState, Button } from "@/components/internal/ui";
import { listHousekeeping, updateHousekeepingStatus } from "@/lib/data/operations";
import { type HousekeepingTask } from "@/lib/mock";

const COLUMNS: { status: HousekeepingTask["status"]; label: string }[] = [
  { status: "PENDING", label: "Pending" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "COMPLETED", label: "Completed" },
];
const PRIORITY_TONE = { LOW: "neutral", NORMAL: "info", HIGH: "warning", URGENT: "danger" } as const;

export default function HousekeepingPage() {
  const qc = useQueryClient();
  const { data: tasks = [], isLoading } = useQuery({ queryKey: ["housekeeping"], queryFn: listHousekeeping });

  const advance = useMutation({
    mutationFn: (t: HousekeepingTask) =>
      updateHousekeepingStatus(t.id, t.status === "PENDING" ? "IN_PROGRESS" : "COMPLETED"),
    onSuccess: () => { toast.success("Task updated."); qc.invalidateQueries({ queryKey: ["housekeeping"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell title="Housekeeping" breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Housekeeping" }]}>
      {isLoading ? (
        <p className="text-sm text-fg-soft">Loading tasks…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const list = tasks.filter((t) => t.status === col.status);
            return (
              <div key={col.status}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</h2>
                  <Badge tone="neutral">{list.length}</Badge>
                </div>
                <div className="space-y-3">
                  {list.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Nothing here.</p>
                  ) : (
                    list.map((t) => (
                      <Card key={t.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <span className="font-medium text-foreground">Room {t.roomNumber}</span>
                          <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority.toLowerCase()}</Badge>
                        </div>
                        <p className="mt-1 text-sm capitalize text-muted-foreground">{t.type.replace(/_/g, " ").toLowerCase()}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{t.assignedTo ?? "Unassigned"}</p>
                        {t.status !== "COMPLETED" && (
                          <Button size="sm" variant="outline" className="mt-3" disabled={advance.isPending && advance.variables?.id === t.id} onClick={() => advance.mutate(t)}>
                            {advance.isPending && advance.variables?.id === t.id ? <Loader2 size={14} className="animate-spin" /> : null}
                            {t.status === "PENDING" ? "Start" : "Complete"} <ArrowRight size={14} />
                          </Button>
                        )}
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!isLoading && tasks.length === 0 && <EmptyState icon={Sparkles} title="No housekeeping tasks" />}
    </PageShell>
  );
}
