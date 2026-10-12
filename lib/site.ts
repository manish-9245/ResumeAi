/** Canonical site URL. Server-side only.
 * Chain: explicit env → Vercel auto domain → localhost (dev only).
 * Vercel injects VERCEL_URL on every deployment, so production metadata,
 * sitemap and robots can never emit localhost even if NEXT_PUBLIC_SITE_URL
 * is unset. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  return "http://localhost:3000";
}
