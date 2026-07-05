import { notFound } from "next/navigation";
import { PageShell } from "@/components/internal/ui";
import { POSTerminal } from "@/components/internal/pos-terminal";
import type { Storefront } from "@/lib/cms";

const MAP: Record<string, { label: string; storefront: Storefront | "BOUTIQUE" }> = {
  restaurant: { label: "Restaurant", storefront: "RESTAURANT" },
  lounge: { label: "Lounge", storefront: "LOUNGE" },
  boutique: { label: "Boutique", storefront: "BOUTIQUE" },
};

export function generateStaticParams() {
  return Object.keys(MAP).map((storefront) => ({ storefront }));
}

export default async function POSPage({
  params,
}: {
  params: Promise<{ storefront: string }>;
}) {
  const { storefront } = await params;
  const cfg = MAP[storefront];
  if (!cfg) notFound();

  return (
    <PageShell
      title={`${cfg.label} POS`}
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "POS" }, { label: cfg.label }]}
    >
      <POSTerminal storefront={cfg.storefront} />
    </PageShell>
  );
}
