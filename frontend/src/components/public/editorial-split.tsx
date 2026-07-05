import { MediaFrame } from "./media-frame";
import { Overline, GhostLink } from "./ui";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

/** The workhorse editorial 7/5 image + text block (§15.4). */
export function EditorialSplit({
  slot,
  overline,
  heading,
  body,
  cta,
  direction = "image-left",
  band = "cream",
}: {
  slot: string;
  overline?: string;
  heading: React.ReactNode;
  body: React.ReactNode;
  cta?: { label: string; href: string };
  direction?: "image-left" | "image-right";
  band?: "cream" | "sand";
}) {
  const onDark = false;
  return (
    <section className={cn("pub-section", band === "sand" ? "bg-pub-sand" : "bg-pub-bg", "text-pub-ink")}>
      <div className="pub-container grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <Reveal
          className={cn(
            "lg:col-span-7",
            direction === "image-right" && "lg:order-2",
          )}
        >
          <MediaFrame
            slot={slot}
            ratio="3/4"
            zoom={false}
            className="rounded-2xl"
            sizes="(max-width: 1024px) 100vw, 55vw"
          />
        </Reveal>

        <Reveal
          delay={0.1}
          className={cn(
            "lg:col-span-5",
            direction === "image-right" && "lg:order-1",
          )}
        >
          {overline && <Overline onDark={onDark} className="mb-3">{overline}</Overline>}
          <h2 className="pub-display-2">{heading}</h2>
          <div className="pub-body mt-5 space-y-4 text-pub-ink-soft">{body}</div>
          {cta && (
            <div className="mt-7">
              <GhostLink href={cta.href}>{cta.label}</GhostLink>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
