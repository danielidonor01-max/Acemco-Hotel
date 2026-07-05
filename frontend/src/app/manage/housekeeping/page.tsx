"use client";

import { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { PageShell, Card, Badge, EmptyState } from "@/components/internal/ui";
import { Button } from "@/components/internal/ui";
import { housekeepingTasks, type HousekeepingTask } from "@/lib/mock";
import { useRooms } from "@/stores/rooms.store";

const COLUMNS: { status: HousekeepingTask["status"]; label: string }[] = [
  { status: "PENDING", label: "Pending" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "COMPLETED", label: "Completed" },
];
const PRIORITY_TONE = { LOW: "neutral", NORMAL: "info", HIGH: "warning", URGENT: "danger" } as const;

export default function HousekeepingPage() {
  const [tasks, setTasks] = useState(housekeepingTasks);
  const setRoomStatus = useRooms((s) => s.setStatus);
  const rooms = useRooms((s) => s.rooms);

  function advance(t: HousekeepingTask) {
    const next = t.status === "PENDING" ? "IN_PROGRESS" : "COMPLETED";
    // Domain rule: completing CHECKOUT_CLEAN → room INSPECTION; INSPECTION → AVAILABLE.
    if (next === "COMPLETED") {
      const room = rooms.find((r) => r.roomNumber === t.roomNumber);
      if (room) {
        if (t.type === "CHECKOUT_CLEAN") setRoomStatus(room.id, "INSPECTION");
        else if (t.type === "INSPECTION") setRoomStatus(room.id, "AVAILABLE");
      }
    }
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
  }

  return (
    <PageShell title="Housekeeping" breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Housekeeping" }]}>
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
                        <Button size="sm" variant="outline" className="mt-3" onClick={() => advance(t)}>
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
      {tasks.length === 0 && <EmptyState icon={Sparkles} title="No housekeeping tasks" />}
    </PageShell>
  );
}
