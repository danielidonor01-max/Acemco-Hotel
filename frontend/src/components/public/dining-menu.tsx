"use client";

import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { MediaFrame } from "./media-frame";
import { formatNaira, cn } from "@/lib/utils";
import { useCart, useCartUI } from "@/stores/cart.store";
import type { Venue, MenuItem } from "@/lib/cms";

/**
 * Public DiningMenu (§15.7): category tabs + item rows. Add-to-cart enabled.
 * Domain rules: isHidden items excluded; isAvailable=false shown greyed, not addable.
 */
export function DiningMenu({ venue }: { venue: Venue }) {
  const [active, setActive] = useState(venue.categories[0]?.id);
  const category = venue.categories.find((c) => c.id === active) ?? venue.categories[0];

  return (
    <div>
      {/* Category tabs */}
      <div className="mb-10 flex flex-wrap gap-2 border-b border-pub-line">
        {venue.categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActive(c.id)}
            className={cn(
              "-mb-px border-b-2 px-4 py-3 pub-cta transition-colors",
              c.id === active
                ? "border-pub-gold text-pub-ink"
                : "border-transparent text-pub-ink-muted hover:text-pub-ink",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      <ul className="grid gap-x-12 gap-y-8 md:grid-cols-2">
        {/* Domain rule: isHidden items are excluded from public menus. */}
        {category.items
          .filter((item) => !item.isHidden)
          .map((item) => (
            <MenuRow key={item.id} item={item} storefront={venue.storefront} />
          ))}
      </ul>
    </div>
  );
}

function MenuRow({ item, storefront }: { item: MenuItem; storefront: Venue["storefront"] }) {
  const add = useCart((s) => s.add);
  const openCart = useCartUI((s) => s.open);
  const [added, setAdded] = useState(false);

  function onAdd() {
    add({ menuItemId: item.id, name: item.name, unitPrice: item.price, storefront });
    setAdded(true);
    openCart();
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <li className={cn("flex gap-4", !item.isAvailable && "opacity-55")}>
      <MediaFrame
        slot={`menu.${item.id}`}
        ratio="1/1"
        src={item.slot}
        alt={item.name}
        className="w-20 shrink-0 rounded-xl md:w-24"
        sizes="96px"
      />
      <div className="flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="pub-body font-medium text-pub-ink">{item.name}</h4>
          <span className="pub-body font-medium text-pub-ink">{formatNaira(item.price)}</span>
        </div>
        <p className="pub-body-sm mt-1 text-pub-ink-soft">{item.description}</p>
        <div className="mt-2.5 flex items-center justify-between">
          <div className="flex gap-1.5">
            {item.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-pub-line px-2 py-0.5 text-[0.7rem] text-pub-ink-muted">
                {tag}
              </span>
            ))}
          </div>
          {item.isAvailable ? (
            <button
              onClick={onAdd}
              aria-label={`Add ${item.name} to cart`}
              className="inline-flex items-center gap-1.5 rounded-full border border-pub-ink px-3.5 py-1.5 pub-cta text-pub-ink transition-colors hover:bg-pub-ink hover:text-pub-bg"
            >
              {added ? <Check size={14} /> : <Plus size={14} />}
              {added ? "Added" : "Add"}
            </button>
          ) : (
            <span className="pub-body-sm italic text-pub-ink-muted">Currently unavailable</span>
          )}
        </div>
      </div>
    </li>
  );
}
