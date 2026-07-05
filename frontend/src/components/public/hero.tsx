import { MediaFrame } from "./media-frame";
import { Overline } from "./ui";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

/**
 * Full-bleed cinematic hero (§15.8). Media fills the section; a heavy scrim
 * guarantees white-on-dark legibility even over a light CMS placeholder.
 */
export function Hero({
  slot,
  overline,
  title,
  subtitle,
  actions,
  size = "page",
  align = "center",
}: {
  slot: string;
  overline?: string;
  title: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
  size?: "full" | "page";
  align?: "center" | "left";
}) {
  return (
    <section
      className={cn(
        "relative flex w-full overflow-hidden bg-pub-espresso text-pub-on-dark",
        size === "full" ? "min-h-[92vh]" : "min-h-[62vh]",
        align === "center" ? "items-center justify-center text-center" : "items-end",
      )}
    >
      <MediaFrame slot={slot} background overlay="scrim-hero" kenburns priority sizes="100vw" />
      <div
        className={cn(
          "pub-container relative z-20 pb-16 pt-32",
          align === "left" && "pb-20",
        )}
      >
        <div className={cn("max-w-3xl", align === "center" && "mx-auto")}>
          {overline && (
            <Reveal slow>
              <Overline onDark className="mb-4">
                {overline}
              </Overline>
            </Reveal>
          )}
          <Reveal slow delay={0.08}>
            <h1 className={size === "full" ? "pub-display-hero" : "pub-display-1"}>{title}</h1>
          </Reveal>
          {subtitle && (
            <Reveal delay={0.18}>
              <p
                className={cn(
                  "pub-body-lg mt-6 text-pub-on-dark-soft",
                  align === "center" && "mx-auto",
                  "max-w-xl",
                )}
              >
                {subtitle}
              </p>
            </Reveal>
          )}
          {actions && (
            <Reveal delay={0.28}>
              <div
                className={cn(
                  "mt-9 flex flex-wrap gap-4",
                  align === "center" && "justify-center",
                )}
              >
                {actions}
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
