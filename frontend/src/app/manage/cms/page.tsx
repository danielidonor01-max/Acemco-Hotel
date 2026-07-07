"use client";

import { Globe, ImageIcon, Pencil, Eye } from "lucide-react";
import { PageShell, Card, CardContent, Button, Badge } from "@/components/internal/ui";
import { roomTypes, offers, amenities } from "@/lib/cms";

/** CMS management (Domain §8.1). Every media slot is a placeholder until populated. */
const CONTENT_BLOCKS = [
  { id: "home-hero", label: "Home — Hero", type: "Media + copy", slots: 1, published: true },
  { id: "home-story", label: "Home — Property Story", type: "Editorial split", slots: 1, published: true },
  { id: "about", label: "About — Brand Story", type: "Editorial splits", slots: 2, published: true },
  { id: "gallery", label: "Gallery", type: "Masonry", slots: 16, published: true },
  { id: "offers", label: "Offers", type: "Cards", slots: offers.length, published: true },
  { id: "amenities", label: "Facilities", type: "Cards", slots: amenities.length, published: false },
  { id: "rooms", label: "Room Imagery", type: "Per room type", slots: roomTypes.length, published: true },
];

export default function CMSPage() {
  return (
    <PageShell
      title="Content (CMS)"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "CMS" }]}
      actions={<Button href="/" variant="outline"><Eye size={16} /> View site</Button>}
    >
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        Manage marketing content and imagery for the public website. Every image position is a
        placeholder until a media asset is uploaded — the site never shows a broken image.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONTENT_BLOCKS.map((b) => (
          <Card key={b.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <Globe size={20} className="text-primary" strokeWidth={1.5} />
                <Badge tone={b.published ? "success" : "warning"}>{b.published ? "Published" : "Draft"}</Badge>
              </div>
              <p className="mt-3 font-semibold text-foreground">{b.label}</p>
              <p className="text-sm text-muted-foreground">{b.type}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <ImageIcon size={13} /> {b.slots} media {b.slots === 1 ? "slot" : "slots"} · placeholders
              </p>
              <Button size="sm" variant="outline" href="/studio" className="mt-4"><Pencil size={14} /> Edit</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
