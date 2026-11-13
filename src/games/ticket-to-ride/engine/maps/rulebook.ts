/**
 * Base URL for the rulebook PDFs. The PDFs are large and static, so they live in
 * object storage (a public Cloudflare R2 bucket) rather than being bundled and
 * served by the app. Override at build time with `VITE_RULES_BASE` (e.g. to point
 * at a different bucket, a custom domain, or local `/public` during development).
 *
 * `import.meta.env` is only defined in Vite/Vitest; the server bundle imports the
 * map modules too, so guard the access and fall back to the default.
 */
const RULES_BASE: string =
  import.meta.env?.VITE_RULES_BASE ??
  'https://pub-dacfe63534bb4d70a18b2a6942be0665.r2.dev/ticket-to-ride';

/** Public URL for a rulebook PDF, e.g. `rulebookUrl('usa.pdf')`. */
export const rulebookUrl = (file: string): string => `${RULES_BASE}/${file}`;
