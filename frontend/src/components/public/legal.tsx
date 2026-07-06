import { Overline } from "./ui";

export interface LegalSection {
  heading: string;
  body: string[];
}

/** Shared layout for legal / policy pages (Privacy, Terms). */
export function LegalPage({
  title,
  intro,
  updated,
  sections,
}: {
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <article className="bg-pub-bg text-pub-ink">
      <div className="pub-container max-w-3xl pt-36 pb-20 md:pt-40">
        <Overline className="mb-3">Legal</Overline>
        <h1 className="pub-display-1">{title}</h1>
        <p className="pub-body-lg mt-5 text-pub-ink-soft">{intro}</p>
        <p className="pub-body-sm mt-4 text-pub-ink-muted">Last updated: {updated}</p>

        <div className="mt-12 space-y-10">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="pub-display-3">{s.heading}</h2>
              <div className="mt-3 space-y-3">
                {s.body.map((p, i) => (
                  <p key={i} className="pub-body text-pub-ink-soft">{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
