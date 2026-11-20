/**
 * Public origin of this deployment, for sitemap.xml / robots.txt. Same
 * resolution as app/layout.tsx's metadataBase, so self-hosted copies and
 * forks never advertise the upstream author's domain.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : "") ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
  "https://openadkit.dicecodes.com"
).replace(/\/+$/, "");
