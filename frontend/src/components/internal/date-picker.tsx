"use client";

import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Styled date picker (Popover + Calendar) — no native date input. */
export function DatePicker({
  value,
  onChange,
  min,
  placeholder = "Select date",
}: {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  min?: string;
  placeholder?: string;
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
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-md border border-line bg-brand-surface px-3 text-sm",
            date ? "text-fg" : "text-fg-muted",
          )}
        >
          <CalendarDays size={15} className="text-brand-primary-dark" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => d && onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)}
          disabled={minDate ? { before: minDate } : undefined}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
