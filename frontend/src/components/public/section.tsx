import { cn } from "@/lib/utils";
import { Overline } from "./ui";
import { Reveal } from "./reveal";

type Band = "cream" | "sand" | "espresso";

const BAND: Record<Band, string> = {
  cream: "bg-pub-bg text-pub-ink",
  sand: "bg-pub-sand text-pub-ink",
  espresso: "bg-pub-espresso text-pub-on-dark",
};

/** Banded section with standard vertical rhythm (§15.4). */
export function Section({
  band = "cream",
  className,
  children,
  id,
}: {
  band?: Band;
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={cn("pub-section", BAND[band], className)}>
      <div className="pub-container">{children}</div>
    </section>
  );
}

/** Overline + display heading + optional intro, centered or left. */
export function SectionHeading({
  overline,
  heading,
  intro,
  align = "left",
  onDark = false,
  className,
}: {
  overline?: string;
  heading: React.ReactNode;
  intro?: string;
  align?: "left" | "center";
  onDark?: boolean;
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {overline && (
        <Overline onDark={onDark} className="mb-3">
          {overline}
        </Overline>
      )}
      <h2 className={cn("pub-display-2", onDark ? "text-pub-on-dark" : "text-pub-ink")}>{heading}</h2>
      {intro && (
        <p
          className={cn(
            "pub-body-lg mt-5",
            onDark ? "text-pub-on-dark-soft" : "text-pub-ink-soft",
            align === "center" && "mx-auto",
          )}
        >
          {intro}
        </p>
      )}
    </Reveal>
  );
}
