"use client";

import { FileBarChart, Play, Download } from "lucide-react";
import { PageShell, Card, CardContent, Button, Badge } from "@/components/internal/ui";
import { reportDefs } from "@/lib/mock-modules";
import { hasPermission } from "@/lib/permissions";

export default function ReportsPage() {
  return (
    <PageShell title="Reports" breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Reports" }]}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportDefs.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex h-full flex-col p-5">
              <div className="flex items-start justify-between">
                <FileBarChart size={22} className="text-primary" strokeWidth={1.5} />
                <Badge tone="neutral">{r.module}</Badge>
              </div>
              <p className="mt-3 font-semibold text-foreground">{r.name}</p>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{r.description}</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm"><Play size={14} /> Run</Button>
                {hasPermission("reports", "EXPORT") && (
                  <Button size="sm" variant="outline"><Download size={14} /> Export</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
