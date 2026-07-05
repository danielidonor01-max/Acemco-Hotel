/** Runtime data-source configuration. Empty vars → fall back to sample content. */
const clean = (v?: string) => (v && v.trim().length > 0 ? v.trim() : undefined);

export const config = {
  apiUrl: clean(process.env.NEXT_PUBLIC_API_URL),
  publicApiUrl: clean(process.env.NEXT_PUBLIC_PUBLIC_API_URL),
  sanity: {
    projectId: clean(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID),
    dataset: clean(process.env.NEXT_PUBLIC_SANITY_DATASET) ?? 'production',
    apiVersion: clean(process.env.NEXT_PUBLIC_SANITY_API_VERSION) ?? '2024-10-01',
  },
};

/** Is the operational API configured? (public reads/writes) */
export const hasPublicApi = () => Boolean(config.publicApiUrl);
/** Is the internal (authenticated) API configured? */
export const hasApi = () => Boolean(config.apiUrl);
/** Is Sanity CMS configured? */
export const hasSanity = () => Boolean(config.sanity.projectId);
