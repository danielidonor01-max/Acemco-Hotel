"use client";

import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Public form field kit — non-native date + select controls styled with the
 * public (pub-*) tokens. No browser-chrome dropdowns or OS date pickers anywhere
 * on the customer site (UI Constitution: consistent, native-UI-free).
 */

// Bordered box that visually matches the public text inputs.
const boxCls =
  "flex h-11 w-full items-center rounded-md border border-pub-line bg-pub-surface px-3 pub-body text-pub-ink transition-colors focus:border-pub-gold focus:outline-none data-[state=open]:border-pub-gold";

// Bare trigger for use inside a field that already provides its own border/label.
const bareCls =
  "flex !h-auto w-full items-center border-0 bg-transparent p-0 pub-body text-pub-ink shadow-none focus:outline-none focus-visible:ring-0";

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PubDatePicker({
  value,
  onChange,
  min,
  placeholder = "Select date",
  bare = false,
  showIcon = true,
}: {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  min?: string;
  placeholder?: string;
  bare?: boolean;
  showIcon?: boolean;
}) {
  const date = value ? new Date(value + "T00:00:00") : undefined;
  const label = date
    ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : placeholder;
  const minDate = min ? new Date(min + "T00:00:00") : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(bare ? bareCls : boxCls, "gap-2 text-left", !date && "text-pub-ink-muted")}
        >
          {showIcon && <CalendarDays size={15} className="shrink-0 text-pub-gold-deep" />}
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => d && onChange(toISO(d))}
          disabled={minDate ? { before: minDate } : undefined}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export function PubSelect({
  value,
  onChange,
  options,
  labels,
  placeholder,
  ariaLabel,
  bare = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
  placeholder?: string;
  ariaLabel?: string;
  bare?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn("justify-between gap-2", bare ? bareCls : `${boxCls} !h-11`)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="border-pub-line bg-pub-surface text-pub-ink">
        {options.map((o) => (
          <SelectItem key={o} value={o} className="pub-body">
            {labels ? labels[o] : o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
