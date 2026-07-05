import { createClient, type SanityClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";
import { config, hasSanity } from "./config";

/** A Sanity image reference/asset (loose — avoids depending on internal type paths). */
export type SanityImageSource =
  | string
  | { _ref?: string; asset?: { _ref?: string } | unknown }
  | Record<string, unknown>;

/**
 * Sanity CMS — marketing content + imagery (Domain §8.1: CMS never holds
 * operational data). Null when unconfigured so callers fall back to samples.
 */
export const sanityClient: SanityClient | null = hasSanity()
  ? createClient({
      projectId: config.sanity.projectId!,
      dataset: config.sanity.dataset,
      apiVersion: config.sanity.apiVersion,
      useCdn: true,
    })
  : null;

const builder = sanityClient ? imageUrlBuilder(sanityClient) : null;

/** Resolve a Sanity image ref to a URL (undefined → MediaFrame placeholder, §15.5). */
export function urlForImage(source?: SanityImageSource, width = 1600): string | undefined {
  if (!builder || !source) return undefined;
  try {
    return builder.image(source as never).width(width).auto("format").url();
  } catch {
    return undefined;
  }
}

/** Run a GROQ query; returns null if Sanity is unconfigured or errors. */
export async function sanityFetch<T>(query: string, params: Record<string, unknown> = {}): Promise<T | null> {
  if (!sanityClient) return null;
  try {
    return await sanityClient.fetch<T>(query, params);
  } catch {
    return null;
  }
}
